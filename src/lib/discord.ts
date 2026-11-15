// Client-safe Discord helpers (no secrets, no network). Server-only calls live in discord.server.ts.

export const DISCORD_API = "https://discord.com/api/v10";
export const DISCORD_AUTHORIZE_URL = "https://discord.com/oauth2/authorize";
/** identify = username, ID, avatar. guilds.members.read = this member's own Free City server membership. */
export const DISCORD_SCOPES = "identify guilds.members.read";
export const DISCORD_CALLBACK_PATH = "/discord/callback";
export const DISCORD_STATE_TTL_MS = 10 * 60 * 1000;

export type GuildStatus = "unknown" | "member" | "not_member" | "reconnect_required";

/** Only accept a plain https origin (or local dev) as the base of the OAuth redirect address. */
export function normalizeRedirectOrigin(origin: string): string | null {
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return null;
  }
  if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
  const isLocal = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if (url.protocol !== "https:" && !isLocal) return null;
  return url.origin;
}

export function buildAuthorizeUrl(clientId: string, redirectUri: string, state: string): string {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: "code",
    redirect_uri: redirectUri,
    scope: DISCORD_SCOPES,
    state,
    prompt: "consent",
  });
  return `${DISCORD_AUTHORIZE_URL}?${params.toString()}`;
}

/** Discord's real avatar, or Discord's own default avatar when the user has none. */
export function discordAvatarUrl(discordUserId: string, avatarHash: string | null): string {
  if (avatarHash) {
    const ext = avatarHash.startsWith("a_") ? "gif" : "png";
    return `https://cdn.discordapp.com/avatars/${discordUserId}/${avatarHash}.${ext}?size=128`;
  }
  let index = 0;
  try {
    index = Number((BigInt(discordUserId) >> 22n) % 6n);
  } catch {
    index = 0;
  }
  return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export type MembershipResult =
  | { kind: "member"; joinedAt: string | null; pending: boolean }
  | { kind: "not_member" }
  | { kind: "reconnect_required" }
  | { kind: "temporary"; message: string };

/** Turn Discord's answer to GET /users/@me/guilds/{guild}/member into a membership result. */
export function interpretMemberResponse(status: number, body: unknown): MembershipResult {
  if (status === 200 && body && typeof body === "object") {
    const b = body as { joined_at?: unknown; pending?: unknown };
    return {
      kind: "member",
      joinedAt: typeof b.joined_at === "string" ? b.joined_at : null,
      pending: b.pending === true,
    };
  }
  // 10004 Unknown Guild: Discord's answer when this user is not in the server.
  if (status === 404) return { kind: "not_member" };
  if (status === 401 || status === 403) return { kind: "reconnect_required" };
  if (status === 429) return { kind: "temporary", message: "Discord is busy right now. Please try again in a minute." };
  return { kind: "temporary", message: "Discord couldn't be reached. Please try again shortly." };
}
