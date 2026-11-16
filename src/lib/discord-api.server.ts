// Server-side HTTP route handler for Discord OAuth2 and Free City Railway Bot API integration.
// Mounted inside src/server.ts before SSR handling.
import { buildAuthorizeUrl, normalizeRedirectOrigin } from "./discord";
import {
  completeMemberDiscordLink,
  discordEnv,
  disconnectMemberDiscord,
  randomToken,
  saveOAuthState,
  syncMemberDiscordAndBot,
} from "./discord.server";
import { ADMIN_EMAIL } from "./firebase";
import { isFirestoreAdminConfigured, verifyFirebaseIdToken } from "./firebase-admin.server";
import { probeRailwayBotHealth, railwayBotEnv } from "./freecity-bot.server";

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

async function readJsonBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const parsed: unknown = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

export async function handleIntegrationApiRequest(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, "") || "/";

  if (!path.startsWith("/api/discord") && path !== "/api/integration/status") {
    return null;
  }

  const user = await verifyFirebaseIdToken(request.headers.get("authorization"));
  if (!user) {
    return jsonResponse({ error: "Please sign in with a verified Google account first." }, 401);
  }

  try {
    // Admin-only non-secret server configuration & Railway API health status
    if (path === "/api/integration/status" && request.method === "GET") {
      if (user.email.trim().toLowerCase() !== ADMIN_EMAIL) {
        return jsonResponse(
          { error: "Admin access is required to inspect integration status." },
          403,
        );
      }

      const discord = discordEnv();
      const railway = railwayBotEnv();
      const firestoreAdminConfigured = await isFirestoreAdminConfigured();
      const shouldProbe = url.searchParams.get("probe") === "1";

      const health = shouldProbe
        ? await probeRailwayBotHealth()
        : {
            configured: railway.configured,
            apiHost: railway.apiHost,
            reachable: null,
            statusCode: null,
            message: railway.configured
              ? "Server-side API key is configured. Click Test Connection to verify /health."
              : "FREE_CITY_BOT_API_URL and FREE_CITY_BOT_API_KEY are not set on the server yet.",
          };

      return jsonResponse({
        botApiConfigured: health.configured,
        botApiHost: health.apiHost,
        botApiReachable: health.reachable,
        botApiStatusCode: health.statusCode,
        botApiMessage: health.message,
        oauthConfigured: discord.oauthConfigured,
        guildConfigured: discord.guildConfigured,
        firestoreAdminConfigured,
      });
    }

    if (path === "/api/discord/start" && request.method === "POST") {
      const discord = discordEnv();
      if (!discord.oauthConfigured) {
        return jsonResponse(
          { error: "Discord OAuth credentials are not configured on the server yet." },
          503,
        );
      }

      const body = await readJsonBody(request);
      const rawOrigin = typeof body?.["origin"] === "string" ? body["origin"] : "";
      const origin = normalizeRedirectOrigin(rawOrigin);
      if (!origin) {
        return jsonResponse({ error: "Invalid redirect origin for Discord authorization." }, 400);
      }

      const state = randomToken(32);
      const redirectUri = `${origin}/discord/callback`;
      await saveOAuthState(user.uid, state, redirectUri);

      return jsonResponse({
        ok: true,
        url: buildAuthorizeUrl(discord.clientId, redirectUri, state),
        redirectUri,
      });
    }

    if (path === "/api/discord/complete" && request.method === "POST") {
      const body = await readJsonBody(request);
      const code = typeof body?.["code"] === "string" ? body["code"].trim() : "";
      const state = typeof body?.["state"] === "string" ? body["state"].trim() : "";
      if (!code || code.length > 512 || !state || state.length < 16 || state.length > 256) {
        return jsonResponse({ error: "Missing or malformed Discord OAuth parameters." }, 400);
      }

      const result = await completeMemberDiscordLink({
        userId: user.uid,
        code,
        state,
      });

      if (!result.ok) {
        return jsonResponse({ error: result.message }, result.status);
      }

      return jsonResponse({
        ok: true,
        botSyncStatus: result.botSyncStatus,
        ...(result.message ? { message: result.message } : {}),
      });
    }

    if (path === "/api/discord/sync" && request.method === "POST") {
      const result = await syncMemberDiscordAndBot(user.uid);
      if (!result.ok) {
        return jsonResponse({ error: result.message }, result.status);
      }
      return jsonResponse({
        ok: true,
        botSyncStatus: result.botSyncStatus,
        ...(result.message ? { message: result.message } : {}),
      });
    }

    if (path === "/api/discord/disconnect" && request.method === "POST") {
      await disconnectMemberDiscord(user.uid);
      return jsonResponse({ ok: true });
    }

    return jsonResponse({ error: "Not found." }, 404);
  } catch (err) {
    console.error("Integration API error:", err);
    return jsonResponse(
      { error: err instanceof Error ? err.message : "Integration request failed." },
      500,
    );
  }
}
