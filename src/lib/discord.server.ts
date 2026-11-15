// Server-only Discord API calls. Never import from components.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import { DISCORD_API, interpretMemberResponse, type MembershipResult } from "./discord";

type Admin = SupabaseClient<Database>;

export type DiscordTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
  scope?: string;
  token_type: string;
};

export type DiscordUser = {
  id: string;
  username: string;
  global_name: string | null;
  avatar: string | null;
};

export function discordEnv() {
  return {
    clientId: process.env["DISCORD_CLIENT_ID"] ?? "",
    clientSecret: process.env["DISCORD_CLIENT_SECRET"] ?? "",
    guildId: process.env["DISCORD_GUILD_ID"] ?? "",
  };
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

export function randomToken(bytes = 32): string {
  const buf = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...buf)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function tokenRequest(body: Record<string, string>): Promise<{ ok: true; data: DiscordTokenResponse } | { ok: false; status: number; text: string }> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
  });
  if (!res.ok) {
    const text = await res.text();
    console.error(`Discord token request failed [${res.status}]: ${text}`);
    return { ok: false, status: res.status, text };
  }
  return { ok: true, data: (await res.json()) as DiscordTokenResponse };
}

export function exchangeCode(code: string, redirectUri: string) {
  const { clientId, clientSecret } = discordEnv();
  return tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
  });
}

export function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = discordEnv();
  return tokenRequest({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });
}

export async function revokeToken(token: string): Promise<void> {
  const { clientId, clientSecret } = discordEnv();
  const res = await fetch(`${DISCORD_API}/oauth2/token/revoke`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, token }).toString(),
  });
  if (!res.ok) console.error(`Discord token revoke failed [${res.status}]: ${await res.text()}`);
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser | null> {
  const res = await fetch(`${DISCORD_API}/users/@me`, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) {
    console.error(`Discord /users/@me failed [${res.status}]: ${await res.text()}`);
    return null;
  }
  const u = (await res.json()) as DiscordUser;
  return { id: u.id, username: u.username, global_name: u.global_name ?? null, avatar: u.avatar ?? null };
}

export async function fetchOwnGuildMembership(accessToken: string, guildId: string): Promise<MembershipResult> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds/${encodeURIComponent(guildId)}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const text = await res.text();
  if (!res.ok && res.status !== 404) console.error(`Discord guild member check failed [${res.status}]: ${text}`);
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = null;
  }
  return interpretMemberResponse(res.status, body);
}

export async function saveTokens(admin: Admin, userId: string, t: DiscordTokenResponse, previousRefresh?: string | null) {
  const { error } = await admin.from("discord_oauth_tokens").upsert({
    user_id: userId,
    access_token: t.access_token,
    refresh_token: t.refresh_token ?? previousRefresh ?? null,
    scope: t.scope ?? null,
    expires_at: new Date(Date.now() + t.expires_in * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });
  if (error) throw error;
}

async function markReconnect(admin: Admin, userId: string) {
  await admin
    .from("discord_connections")
    .update({ guild_status: "reconnect_required", guild_checked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("user_id", userId);
}

/** Valid access token for this member, refreshing it when it is about to expire. Null means reconnect needed. */
async function getValidAccessToken(admin: Admin, userId: string): Promise<string | null> {
  const { data: row, error } = await admin
    .from("discord_oauth_tokens")
    .select("access_token, refresh_token, expires_at")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!row) return null;
  if (new Date(row.expires_at).getTime() - Date.now() > 60_000) return row.access_token;
  if (!row.refresh_token) return null;
  const refreshed = await refreshAccessToken(row.refresh_token);
  if (!refreshed.ok) return null;
  await saveTokens(admin, userId, refreshed.data, row.refresh_token);
  return refreshed.data.access_token;
}

export type CheckResult = { ok: true } | { ok: false; message: string };

/** Ask Discord whether this member is in the Free City server and store the answer. */
export async function checkAndStoreMembership(admin: Admin, userId: string): Promise<CheckResult> {
  const { guildId } = discordEnv();
  if (!guildId) return { ok: false, message: "The Free City server check isn't set up yet." };

  const token = await getValidAccessToken(admin, userId);
  if (!token) {
    await markReconnect(admin, userId);
    return { ok: false, message: "Please reconnect your Discord account." };
  }

  const result = await fetchOwnGuildMembership(token, guildId);
  const now = new Date().toISOString();
  if (result.kind === "temporary") return { ok: false, message: result.message };
  if (result.kind === "reconnect_required") {
    await markReconnect(admin, userId);
    return { ok: false, message: "Please reconnect your Discord account." };
  }

  const update =
    result.kind === "member"
      ? { guild_status: "member", guild_pending: result.pending, guild_joined_at: result.joinedAt }
      : { guild_status: "not_member", guild_pending: false, guild_joined_at: null };
  const { error } = await admin
    .from("discord_connections")
    .update({ ...update, guild_checked_at: now, updated_at: now })
    .eq("user_id", userId);
  if (error) throw error;
  return { ok: true };
}
