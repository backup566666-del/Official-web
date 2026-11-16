// Server-only Discord OAuth2, guild membership, and Firestore Admin persistence.
// Never import this file from client components.
import {
  DISCORD_API,
  DISCORD_STATE_TTL_MS,
  discordAvatarUrl,
  interpretMemberResponse,
  type MembershipResult,
} from "./discord";
import type { BotSyncStatus } from "./firebase";
import {
  firestoreDeleteDoc,
  firestoreFindConnectionByDiscordUserId,
  firestoreGetDoc,
  firestoreSetDoc,
} from "./firebase-admin.server";
import { fetchRailwayBotMember, type RailwayMemberLookupResult } from "./freecity-bot.server";

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

type StoredOAuthState = {
  stateHash: string;
  userId: string;
  redirectUri: string;
  expiresAt: string;
};

type StoredOAuthTokens = {
  userId: string;
  accessToken: string;
  refreshToken?: string;
  scope?: string;
  expiresAt: string;
  updatedAt: string;
};

type StoredDiscordConnection = {
  userId: string;
  discordUserId: string;
  username: string;
  globalName?: string;
  avatarUrl?: string;
  guildStatus: "unknown" | "member" | "not_member" | "reconnect_required";
  guildPending: boolean;
  roleIds?: string[];
  roles?: string[];
  level?: number;
  xp?: number;
  messageCount?: number;
  vipStatus?: string;
  premiumActive?: boolean;
  premiumTier?: string;
  premiumExpiresAt?: string;
  aiAccessEnabled?: boolean;
  aiAccessTier?: string;
  guildJoinedAt?: string;
  guildCheckedAt?: string;
  botSyncedAt?: string;
  botSyncStatus?: BotSyncStatus;
  connectedAt: string;
  updatedAt: string;
};

export function discordEnv() {
  const clientId = (process.env["DISCORD_CLIENT_ID"] ?? "").trim();
  const clientSecret = (process.env["DISCORD_CLIENT_SECRET"] ?? "").trim();
  const guildId = (process.env["DISCORD_GUILD_ID"] ?? "").trim();
  return {
    clientId,
    clientSecret,
    guildId,
    oauthConfigured: Boolean(clientId && clientSecret),
    guildConfigured: Boolean(guildId),
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

async function tokenRequest(
  body: Record<string, string>,
): Promise<{ ok: true; data: DiscordTokenResponse } | { ok: false; status: number; text: string }> {
  const res = await fetch(`${DISCORD_API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams(body).toString(),
    signal: AbortSignal.timeout(8000),
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
  if (!clientId || !clientSecret || !token) return;
  try {
    const res = await fetch(`${DISCORD_API}/oauth2/token/revoke`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, token }).toString(),
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) console.error(`Discord token revoke failed [${res.status}]: ${await res.text()}`);
  } catch (err) {
    console.error("Discord token revoke error:", err);
  }
}

export async function fetchDiscordUser(accessToken: string): Promise<DiscordUser | null> {
  const res = await fetch(`${DISCORD_API}/users/@me`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    console.error(`Discord /users/@me failed [${res.status}]: ${await res.text()}`);
    return null;
  }
  const u = (await res.json()) as DiscordUser;
  return {
    id: u.id,
    username: u.username,
    global_name: u.global_name ?? null,
    avatar: u.avatar ?? null,
  };
}

export async function fetchOwnGuildMembership(accessToken: string, guildId: string): Promise<MembershipResult> {
  const res = await fetch(`${DISCORD_API}/users/@me/guilds/${encodeURIComponent(guildId)}/member`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    signal: AbortSignal.timeout(8000),
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

export async function saveOAuthState(userId: string, state: string, redirectUri: string): Promise<void> {
  const stateHash = await sha256Hex(state);
  const expiresAt = new Date(Date.now() + DISCORD_STATE_TTL_MS).toISOString();
  const payload: StoredOAuthState = {
    stateHash,
    userId,
    redirectUri,
    expiresAt,
  };
  await firestoreSetDoc("discordOAuthStates", stateHash, payload);
}

export async function consumeOAuthState(state: string, expectedUserId: string): Promise<StoredOAuthState | null> {
  const stateHash = await sha256Hex(state);
  const record = await firestoreGetDoc<StoredOAuthState>("discordOAuthStates", stateHash);
  await firestoreDeleteDoc("discordOAuthStates", stateHash);
  if (!record) return null;
  if (record.userId !== expectedUserId) return null;
  if (Number.isNaN(Date.parse(record.expiresAt)) || Date.parse(record.expiresAt) < Date.now()) {
    return null;
  }
  return record;
}

export async function saveOAuthTokens(
  userId: string,
  tokens: DiscordTokenResponse,
  previousRefresh?: string,
): Promise<void> {
  const now = new Date().toISOString();
  const refreshToken = tokens.refresh_token ?? previousRefresh;
  const doc: StoredOAuthTokens = {
    userId,
    accessToken: tokens.access_token,
    ...(refreshToken ? { refreshToken } : {}),
    ...(tokens.scope ? { scope: tokens.scope } : {}),
    expiresAt: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
    updatedAt: now,
  };
  await firestoreSetDoc("discordOAuthTokens", userId, doc);
}

async function getValidAccessToken(userId: string): Promise<string | null> {
  const row = await firestoreGetDoc<StoredOAuthTokens>("discordOAuthTokens", userId);
  if (!row || !row.accessToken) return null;
  if (Date.parse(row.expiresAt) - Date.now() > 60_000) {
    return row.accessToken;
  }
  if (!row.refreshToken) return null;
  const refreshed = await refreshAccessToken(row.refreshToken);
  if (!refreshed.ok) return null;
  await saveOAuthTokens(userId, refreshed.data, row.refreshToken);
  return refreshed.data.access_token;
}

function mergeConnectionRecord(params: {
  userId: string;
  existing: StoredDiscordConnection | null;
  discordUser?: DiscordUser;
  membership?: MembershipResult;
  railway: RailwayMemberLookupResult;
  now: string;
}): StoredDiscordConnection {
  const { userId, existing, discordUser, membership, railway, now } = params;

  const syncedUsername = railway.status === "synced" ? railway.data.username : undefined;
  const syncedGlobalName = railway.status === "synced" ? railway.data.globalName : undefined;
  const syncedAvatarUrl = railway.status === "synced" ? railway.data.avatarUrl : undefined;

  const discordUserId = discordUser?.id ?? existing?.discordUserId ?? "";
  const username = discordUser?.username ?? syncedUsername ?? existing?.username ?? "";
  const globalName = discordUser?.global_name ?? syncedGlobalName ?? existing?.globalName;
  const avatarUrl = discordUser
    ? discordAvatarUrl(discordUser.id, discordUser.avatar)
    : existing?.avatarUrl ?? syncedAvatarUrl;

  let guildStatus: StoredDiscordConnection["guildStatus"] = existing?.guildStatus ?? "unknown";
  let guildPending = existing?.guildPending ?? false;
  let roleIds = existing?.roleIds ?? [];
  let guildJoinedAt = existing?.guildJoinedAt;
  let guildCheckedAt = existing?.guildCheckedAt;

  if (membership) {
    guildCheckedAt = now;
    if (membership.kind === "member") {
      guildStatus = "member";
      guildPending = membership.pending;
      roleIds = membership.roleIds;
      if (membership.joinedAt) guildJoinedAt = membership.joinedAt;
    } else if (membership.kind === "not_member") {
      guildStatus = "not_member";
      guildPending = false;
      roleIds = [];
      guildJoinedAt = undefined;
    } else if (membership.kind === "reconnect_required") {
      guildStatus = "reconnect_required";
    }
  } else if (railway.status === "synced" && typeof railway.data.inGuild === "boolean" && guildStatus === "unknown") {
    guildStatus = railway.data.inGuild ? "member" : "not_member";
    guildCheckedAt = now;
  }

  const botSyncStatus: BotSyncStatus = railway.status;
  const syncedData = railway.status === "synced" ? railway.data : null;

  const roles =
    syncedData && syncedData.roles.length > 0
      ? syncedData.roles
      : guildStatus === "not_member"
        ? []
        : existing?.roles;

  if (syncedData && syncedData.roleIds.length > 0 && roleIds.length === 0) {
    roleIds = syncedData.roleIds;
  }

  const level = syncedData?.level ?? existing?.level;
  const xp = syncedData?.xp ?? existing?.xp;
  const messageCount = syncedData?.messageCount ?? existing?.messageCount;
  const vipStatus = syncedData?.vipStatus ?? existing?.vipStatus;
  const premiumActive = syncedData?.premiumActive ?? existing?.premiumActive;
  const premiumTier = syncedData?.premiumTier ?? existing?.premiumTier;
  const premiumExpiresAt = syncedData?.premiumExpiresAt ?? existing?.premiumExpiresAt;
  const aiAccessEnabled = syncedData?.aiAccessEnabled ?? existing?.aiAccessEnabled;
  const aiAccessTier = syncedData?.aiAccessTier ?? existing?.aiAccessTier;
  const botSyncedAt = syncedData ? now : existing?.botSyncedAt;

  return {
    userId,
    discordUserId,
    username,
    ...(globalName ? { globalName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    guildStatus,
    guildPending,
    ...(roleIds.length > 0 ? { roleIds } : {}),
    ...(roles && roles.length > 0 ? { roles } : {}),
    ...(level !== undefined ? { level } : {}),
    ...(xp !== undefined ? { xp } : {}),
    ...(messageCount !== undefined ? { messageCount } : {}),
    ...(vipStatus ? { vipStatus } : {}),
    ...(premiumActive !== undefined ? { premiumActive } : {}),
    ...(premiumTier ? { premiumTier } : {}),
    ...(premiumExpiresAt ? { premiumExpiresAt } : {}),
    ...(aiAccessEnabled !== undefined ? { aiAccessEnabled } : {}),
    ...(aiAccessTier ? { aiAccessTier } : {}),
    ...(guildJoinedAt ? { guildJoinedAt } : {}),
    ...(guildCheckedAt ? { guildCheckedAt } : {}),
    ...(botSyncedAt ? { botSyncedAt } : {}),
    botSyncStatus,
    connectedAt: existing?.connectedAt ?? now,
    updatedAt: now,
  };
}

export async function completeMemberDiscordLink(params: {
  userId: string;
  code: string;
  state: string;
}): Promise<{ ok: true; botSyncStatus: BotSyncStatus; message?: string } | { ok: false; status: number; message: string }> {
  const { oauthConfigured, guildId } = discordEnv();
  if (!oauthConfigured) {
    return { ok: false, status: 503, message: "Discord OAuth is not configured on the server yet." };
  }

  const stateRecord = await consumeOAuthState(params.state, params.userId);
  if (!stateRecord) {
    return {
      ok: false,
      status: 400,
      message: "This Discord authorization link expired or belongs to another member. Please try again.",
    };
  }

  const tokens = await exchangeCode(params.code, stateRecord.redirectUri);
  if (!tokens.ok) {
    return { ok: false, status: 400, message: "Discord rejected the authorization code. Please try connecting again." };
  }

  const discordUser = await fetchDiscordUser(tokens.data.access_token);
  if (!discordUser) {
    return { ok: false, status: 502, message: "Could not load your Discord account profile." };
  }

  const existingOwner = await firestoreFindConnectionByDiscordUserId(discordUser.id);
  if (existingOwner && existingOwner.userId !== params.userId) {
    await revokeToken(tokens.data.access_token);
    return {
      ok: false,
      status: 409,
      message: "This Discord account is already connected to another Free City member.",
    };
  }

  const existingConnection = await firestoreGetDoc<StoredDiscordConnection>("discordConnections", params.userId);
  const membership = guildId ? await fetchOwnGuildMembership(tokens.data.access_token, guildId) : undefined;
  const railway = await fetchRailwayBotMember(discordUser.id);
  const now = new Date().toISOString();

  await saveOAuthTokens(params.userId, tokens.data);

  const merged = mergeConnectionRecord({
    userId: params.userId,
    existing: existingConnection,
    discordUser,
    ...(membership ? { membership } : {}),
    railway,
    now,
  });

  await firestoreSetDoc("discordConnections", params.userId, merged);

  return {
    ok: true,
    botSyncStatus: railway.status,
    ...(railway.status !== "synced" ? { message: railway.message } : {}),
  };
}

export async function syncMemberDiscordAndBot(
  userId: string,
): Promise<{ ok: true; botSyncStatus: BotSyncStatus; message?: string } | { ok: false; status: number; message: string }> {
  const existing = await firestoreGetDoc<StoredDiscordConnection>("discordConnections", userId);
  if (!existing || !existing.discordUserId) {
    return { ok: false, status: 404, message: "Connect your Discord account first." };
  }

  const { guildId } = discordEnv();
  const accessToken = await getValidAccessToken(userId);
  let discordUser: DiscordUser | undefined;
  let membership: MembershipResult | undefined;

  if (accessToken) {
    discordUser = (await fetchDiscordUser(accessToken)) ?? undefined;
    if (guildId) {
      membership = await fetchOwnGuildMembership(accessToken, guildId);
    }
  } else if (guildId) {
    membership = { kind: "reconnect_required" };
  }

  const railway = await fetchRailwayBotMember(existing.discordUserId);
  const now = new Date().toISOString();

  const merged = mergeConnectionRecord({
    userId,
    existing,
    ...(discordUser ? { discordUser } : {}),
    ...(membership ? { membership } : {}),
    railway,
    now,
  });

  await firestoreSetDoc("discordConnections", userId, merged);

  return {
    ok: true,
    botSyncStatus: railway.status,
    ...(railway.status !== "synced" ? { message: railway.message } : {}),
  };
}

export async function disconnectMemberDiscord(userId: string): Promise<void> {
  const tokenRow = await firestoreGetDoc<StoredOAuthTokens>("discordOAuthTokens", userId);
  if (tokenRow) {
    await revokeToken(tokenRow.refreshToken ?? tokenRow.accessToken);
  }
  await Promise.all([
    firestoreDeleteDoc("discordOAuthTokens", userId),
    firestoreDeleteDoc("discordConnections", userId),
  ]);
}
