// Server-only client for the Free City Railway Bot HTTP API.
// Proposed contract:
//   - Health check:  GET /health
//   - Member lookup: GET /api/members/:discordUserId
//   - Auth header:   x-api-key: <FREE_CITY_BOT_API_KEY>
// Never import this file from client components.

import type { BotSyncStatus } from "./firebase";

export type RailwayMemberData = {
  inGuild?: boolean;
  username?: string;
  globalName?: string;
  avatarUrl?: string;
  roles: string[];
  roleIds: string[];
  xp?: number;
  level?: number;
  messageCount?: number;
  vipStatus?: string;
  premiumActive?: boolean;
  premiumTier?: string;
  premiumExpiresAt?: string;
  aiAccessEnabled?: boolean;
  aiAccessTier?: string;
};

export type RailwayMemberLookupResult =
  | { status: Extract<BotSyncStatus, "not_configured">; message: string }
  | { status: Extract<BotSyncStatus, "not_found">; message: string }
  | { status: Extract<BotSyncStatus, "error">; message: string }
  | { status: Extract<BotSyncStatus, "synced">; data: RailwayMemberData };

export type RailwayHealthResult = {
  configured: boolean;
  apiHost: string | null;
  reachable: boolean | null;
  statusCode: number | null;
  message: string;
};

function normalizeBaseUrl(raw: string | undefined): string {
  const trimmed = (raw ?? "").trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const parsed = new URL(trimmed);
    const isLocal = parsed.protocol === "http:" && (parsed.hostname === "localhost" || parsed.hostname === "127.0.0.1");
    if (parsed.protocol !== "https:" && !isLocal) return "";
    return parsed.origin + parsed.pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
}

export function railwayBotEnv() {
  const url = normalizeBaseUrl(process.env["FREE_CITY_BOT_API_URL"]);
  const apiKey = (process.env["FREE_CITY_BOT_API_KEY"] ?? "").trim();
  let apiHost: string | null = null;
  if (url) {
    try {
      apiHost = new URL(url).host;
    } catch {
      apiHost = null;
    }
  }
  return {
    url,
    apiKey,
    apiHost,
    configured: Boolean(url && apiKey),
  };
}

export async function probeRailwayBotHealth(): Promise<RailwayHealthResult> {
  const { url, apiKey, apiHost, configured } = railwayBotEnv();
  if (!configured) {
    return {
      configured: false,
      apiHost,
      reachable: null,
      statusCode: null,
      message: "FREE_CITY_BOT_API_URL and FREE_CITY_BOT_API_KEY are not configured on the server yet.",
    };
  }

  try {
    const res = await fetch(`${url}/health`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.ok) {
      return {
        configured: true,
        apiHost,
        reachable: true,
        statusCode: res.status,
        message: "Railway bot API /health responded successfully.",
      };
    }

    return {
      configured: true,
      apiHost,
      reachable: false,
      statusCode: res.status,
      message: `Railway bot API /health returned HTTP ${res.status}.`,
    };
  } catch (err) {
    return {
      configured: true,
      apiHost,
      reachable: false,
      statusCode: null,
      message: err instanceof Error ? `Could not reach Railway bot API: ${err.message}` : "Could not reach Railway bot API.",
    };
  }
}

function asOptionalFiniteNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function asOptionalNonEmptyString(value: unknown, maxLen = 100): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim().slice(0, maxLen);
  return trimmed.length > 0 ? trimmed : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const items: string[] = [];
  for (const item of value) {
    if (typeof item === "string" && item.trim()) {
      items.push(item.trim().slice(0, 100));
    } else if (item && typeof item === "object" && "name" in item && typeof (item as { name: unknown }).name === "string") {
      const name = (item as { name: string }).name.trim().slice(0, 100);
      if (name) items.push(name);
    }
  }
  return items.slice(0, 50);
}

export function normalizeRailwayMemberPayload(raw: unknown): RailwayMemberData {
  const payload = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const member =
    payload["member"] && typeof payload["member"] === "object"
      ? (payload["member"] as Record<string, unknown>)
      : payload;
  const profile =
    member["profile"] && typeof member["profile"] === "object"
      ? (member["profile"] as Record<string, unknown>)
      : member;
  const premiumObj =
    member["premium"] && typeof member["premium"] === "object"
      ? (member["premium"] as Record<string, unknown>)
      : undefined;
  const aiObj =
    member["aiAccess"] && typeof member["aiAccess"] === "object"
      ? (member["aiAccess"] as Record<string, unknown>)
      : member["ai"] && typeof member["ai"] === "object"
        ? (member["ai"] as Record<string, unknown>)
        : undefined;

  const inGuildRaw = member["inGuild"] ?? member["isMember"];
  const inGuild = typeof inGuildRaw === "boolean" ? inGuildRaw : undefined;

  const roles = asStringArray(member["roles"]);
  const roleIds = asStringArray(member["roleIds"]);
  const xp = asOptionalFiniteNumber(member["xp"]);
  const level = asOptionalFiniteNumber(member["level"]);
  const messageCount = asOptionalFiniteNumber(member["messageCount"] ?? member["messages"] ?? member["message_count"]);

  const premiumActiveRaw = premiumObj?.["active"] ?? member["premiumActive"] ?? member["isPremium"];
  const premiumActive = typeof premiumActiveRaw === "boolean" ? premiumActiveRaw : undefined;
  const premiumTier = asOptionalNonEmptyString(
    premiumObj?.["tier"] ?? premiumObj?.["plan"] ?? member["premiumTier"],
  );
  const premiumExpiresAt = asOptionalNonEmptyString(
    premiumObj?.["expiresAt"] ?? member["premiumExpiresAt"],
    64,
  );
  const vipStatus = asOptionalNonEmptyString(
    member["vipStatus"] ?? (premiumActive === true ? premiumTier || "Active Premium" : undefined),
  );

  const aiEnabledRaw = aiObj?.["enabled"] ?? aiObj?.["active"] ?? member["aiAccessEnabled"] ?? member["hasAiAccess"];
  const aiAccessEnabled = typeof aiEnabledRaw === "boolean" ? aiEnabledRaw : undefined;
  const aiAccessTier = asOptionalNonEmptyString(aiObj?.["tier"] ?? aiObj?.["plan"] ?? member["aiAccessTier"]);

  const username = asOptionalNonEmptyString(profile["username"]);
  const globalName = asOptionalNonEmptyString(profile["globalName"] ?? profile["displayName"]);
  const avatarUrl = asOptionalNonEmptyString(profile["avatarUrl"], 500);

  return {
    ...(inGuild !== undefined ? { inGuild } : {}),
    ...(username ? { username } : {}),
    ...(globalName ? { globalName } : {}),
    ...(avatarUrl ? { avatarUrl } : {}),
    roles,
    roleIds,
    ...(xp !== undefined ? { xp } : {}),
    ...(level !== undefined ? { level } : {}),
    ...(messageCount !== undefined ? { messageCount } : {}),
    ...(vipStatus ? { vipStatus } : {}),
    ...(premiumActive !== undefined ? { premiumActive } : {}),
    ...(premiumTier ? { premiumTier } : {}),
    ...(premiumExpiresAt ? { premiumExpiresAt } : {}),
    ...(aiAccessEnabled !== undefined ? { aiAccessEnabled } : {}),
    ...(aiAccessTier ? { aiAccessTier } : {}),
  };
}

export async function fetchRailwayBotMember(discordUserId: string): Promise<RailwayMemberLookupResult> {
  if (!/^\d{15,25}$/.test(discordUserId)) {
    return { status: "error", message: "Invalid Discord user ID format." };
  }

  const { url, apiKey, configured } = railwayBotEnv();
  if (!configured) {
    return {
      status: "not_configured",
      message: "Free City Railway bot API is not configured yet.",
    };
  }

  try {
    const res = await fetch(`${url}/api/members/${encodeURIComponent(discordUserId)}`, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(8000),
    });

    if (res.status === 404) {
      return {
        status: "not_found",
        message: "No record found for this Discord user in the Free City bot database yet.",
      };
    }

    if (!res.ok) {
      console.error(`Free City Railway API lookup failed [${res.status}]: ${await res.text()}`);
      return {
        status: "error",
        message: `Railway bot API returned HTTP ${res.status}.`,
      };
    }

    const body: unknown = await res.json();
    return {
      status: "synced",
      data: normalizeRailwayMemberPayload(body),
    };
  } catch (err) {
    console.error("Free City Railway API lookup error:", err);
    return {
      status: "error",
      message: err instanceof Error ? err.message : "Failed to reach the Railway bot API.",
    };
  }
}
