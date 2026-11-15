import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  DISCORD_CALLBACK_PATH,
  DISCORD_STATE_TTL_MS,
  buildAuthorizeUrl,
  discordAvatarUrl,
  normalizeRedirectOrigin,
  type GuildStatus,
} from "./discord";
import {
  checkAndStoreMembership,
  discordEnv,
  exchangeCode,
  fetchDiscordUser,
  randomToken,
  revokeToken,
  saveTokens,
  sha256Hex,
} from "./discord.server";

export type DiscordStatus = {
  oauthConfigured: boolean;
  guildConfigured: boolean;
  connection: null | {
    discordUserId: string;
    username: string;
    globalName: string | null;
    avatarUrl: string;
    connectedAt: string;
    guildStatus: GuildStatus;
    guildPending: boolean;
    guildJoinedAt: string | null;
    guildCheckedAt: string | null;
  };
};

type ActionResult = { ok: true } | { ok: false; message: string };

/** The signed-in member's own Discord connection and server membership, read as that member. */
export const getDiscordStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<DiscordStatus> => {
    const env = discordEnv();
    const { data, error } = await context.supabase
      .from("discord_connections")
      .select("discord_user_id, username, global_name, avatar_hash, connected_at, guild_status, guild_pending, guild_joined_at, guild_checked_at")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (error) {
      console.error("Loading Discord connection failed", error);
      throw new Error("Couldn't load your Discord connection.");
    }
    return {
      oauthConfigured: Boolean(env.clientId && env.clientSecret),
      guildConfigured: Boolean(env.guildId),
      connection: data
        ? {
            discordUserId: data.discord_user_id,
            username: data.username,
            globalName: data.global_name,
            avatarUrl: discordAvatarUrl(data.discord_user_id, data.avatar_hash),
            connectedAt: data.connected_at,
            guildStatus: data.guild_status as GuildStatus,
            guildPending: data.guild_pending,
            guildJoinedAt: data.guild_joined_at,
            guildCheckedAt: data.guild_checked_at,
          }
        : null,
    };
  });

/** Creates a one-time check tied to this member and returns Discord's consent page address. */
export const startDiscordConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ origin: z.string().min(1).max(200) }).parse(input))
  .handler(async ({ data, context }): Promise<{ ok: true; url: string } | { ok: false; message: string }> => {
    const env = discordEnv();
    if (!env.clientId || !env.clientSecret) {
      return { ok: false, message: "Discord connection isn't switched on yet." };
    }
    const origin = normalizeRedirectOrigin(data.origin);
    if (!origin) return { ok: false, message: "This page address can't be used for Discord sign-in." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("discord_oauth_states").delete().lt("expires_at", new Date().toISOString());

    const state = randomToken();
    const redirectUri = `${origin}${DISCORD_CALLBACK_PATH}`;
    const { error } = await supabaseAdmin.from("discord_oauth_states").insert({
      state_hash: await sha256Hex(state),
      user_id: context.userId,
      redirect_uri: redirectUri,
      expires_at: new Date(Date.now() + DISCORD_STATE_TTL_MS).toISOString(),
    });
    if (error) {
      console.error("Saving Discord state failed", error);
      return { ok: false, message: "Couldn't start the Discord connection. Please try again." };
    }
    return { ok: true, url: buildAuthorizeUrl(env.clientId, redirectUri, state) };
  });

/** Finishes the connection: only the same signed-in member who started it can complete it. */
export const completeDiscordConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) =>
    z.object({ code: z.string().min(1).max(512), state: z.string().min(16).max(256) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ActionResult> => {
    const env = discordEnv();
    if (!env.clientId || !env.clientSecret) return { ok: false, message: "Discord connection isn't switched on yet." };

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    // Single use: the check is deleted as it is read.
    const { data: stateRow, error: stateError } = await supabaseAdmin
      .from("discord_oauth_states")
      .delete()
      .eq("state_hash", await sha256Hex(data.state))
      .select("user_id, redirect_uri, expires_at")
      .maybeSingle();
    if (stateError) {
      console.error("Reading Discord state failed", stateError);
      return { ok: false, message: "Couldn't finish the Discord connection. Please try again." };
    }
    if (!stateRow || stateRow.user_id !== context.userId || new Date(stateRow.expires_at).getTime() < Date.now()) {
      return { ok: false, message: "This Discord connection link has expired or was started from another account. Please try again from your dashboard." };
    }

    const tokens = await exchangeCode(data.code, stateRow.redirect_uri);
    if (!tokens.ok) return { ok: false, message: "Discord didn't accept the connection. Please try again." };

    const discordUser = await fetchDiscordUser(tokens.data.access_token);
    if (!discordUser) return { ok: false, message: "Couldn't read your Discord account. Please try again." };

    const { data: existing } = await supabaseAdmin
      .from("discord_connections")
      .select("user_id")
      .eq("discord_user_id", discordUser.id)
      .maybeSingle();
    if (existing && existing.user_id !== context.userId) {
      await revokeToken(tokens.data.access_token);
      return { ok: false, message: "This Discord account is already connected to another Free City member." };
    }

    const now = new Date().toISOString();
    const { error: upsertError } = await supabaseAdmin.from("discord_connections").upsert({
      user_id: context.userId,
      discord_user_id: discordUser.id,
      username: discordUser.username,
      global_name: discordUser.global_name,
      avatar_hash: discordUser.avatar,
      connected_at: now,
      updated_at: now,
      guild_status: "unknown",
      guild_pending: false,
      guild_joined_at: null,
      guild_checked_at: null,
    });
    if (upsertError) {
      console.error("Saving Discord connection failed", upsertError);
      return { ok: false, message: "Couldn't save your Discord connection. Please try again." };
    }
    await saveTokens(supabaseAdmin, context.userId, tokens.data);

    if (env.guildId) await checkAndStoreMembership(supabaseAdmin, context.userId);
    return { ok: true };
  });

/** Re-checks the member's Free City server membership with Discord. */
export const checkDiscordMembership = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActionResult> => {
    const env = discordEnv();
    if (!env.clientId || !env.clientSecret) return { ok: false, message: "Discord connection isn't switched on yet." };
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: conn } = await supabaseAdmin
      .from("discord_connections")
      .select("user_id")
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!conn) return { ok: false, message: "Connect your Discord account first." };
    return checkAndStoreMembership(supabaseAdmin, context.userId);
  });

/** Removes the member's Discord connection and revokes the saved Discord access. */
export const disconnectDiscord = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActionResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: tokenRow } = await supabaseAdmin
      .from("discord_oauth_tokens")
      .select("access_token, refresh_token")
      .eq("user_id", context.userId)
      .maybeSingle();
    const env = discordEnv();
    if (tokenRow && env.clientId && env.clientSecret) {
      await revokeToken(tokenRow.refresh_token ?? tokenRow.access_token);
    }
    const { error } = await supabaseAdmin.from("discord_connections").delete().eq("user_id", context.userId);
    if (error) {
      console.error("Removing Discord connection failed", error);
      return { ok: false, message: "Couldn't disconnect Discord. Please try again." };
    }
    return { ok: true };
  });
