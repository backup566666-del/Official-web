// Server-only Google OAuth 2.0 & signed session helpers. Never import from client components.
import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://openidconnect.googleapis.com/v1/userinfo";
const SESSION_COOKIE_NAME = "fc_google_session";
const STATE_TTL_MS = 10 * 60 * 1000;
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

// Ephemeral fallback key only when AUTH_SESSION_SECRET is not set.
let ephemeralSecret: string | undefined;

function getSessionSecret(): string {
  const configured = process.env["AUTH_SESSION_SECRET"]?.trim();
  if (configured) return configured;
  const clientSecret = process.env["GOOGLE_CLIENT_SECRET"]?.trim();
  if (clientSecret) {
    return createHmac("sha256", "free-city-session-derivation").update(clientSecret).digest("hex");
  }
  if (!ephemeralSecret) {
    ephemeralSecret = randomBytes(32).toString("hex");
  }
  return ephemeralSecret;
}

export function googleOAuthEnv() {
  return {
    clientId: process.env["GOOGLE_CLIENT_ID"]?.trim() ?? "",
    clientSecret: process.env["GOOGLE_CLIENT_SECRET"]?.trim() ?? "",
  };
}

export function isGoogleOAuthConfigured(): boolean {
  const { clientId, clientSecret } = googleOAuthEnv();
  return Boolean(clientId && clientSecret);
}

export function normalizeOrigin(rawOrigin: string | null | undefined): string | null {
  if (!rawOrigin) return null;
  try {
    const url = new URL(rawOrigin);
    if (url.pathname !== "/" || url.search || url.hash || url.username || url.password) return null;
    const isLocal = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
    if (url.protocol !== "https:" && !isLocal) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function resolveRequestOrigin(request: Request, explicitOrigin?: string | null): string | null {
  const fromParam = normalizeOrigin(explicitOrigin);
  if (fromParam) return fromParam;

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https";
  if (forwardedHost) {
    const fromForwarded = normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
    if (fromForwarded) return fromForwarded;
  }

  const fromAppUrl = normalizeOrigin(process.env["APP_URL"]);
  if (fromAppUrl) return fromAppUrl;

  try {
    return normalizeOrigin(new URL(request.url).origin);
  } catch {
    return null;
  }
}

function signPayload(payload: object): string {
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  const sig = createHmac("sha256", getSessionSecret()).update(encoded).digest("base64url");
  return `${encoded}.${sig}`;
}

function verifySignedPayload<T>(token: string): T | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expected = createHmac("sha256", getSessionSecret()).update(encoded).digest("base64url");
  const sigBuf = Buffer.from(sig, "utf8");
  const expBuf = Buffer.from(expected, "utf8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

type OAuthStatePayload = {
  nonce: string;
  redirectUri: string;
  origin: string;
  mode: "popup" | "redirect";
  exp: number;
};

export type GoogleSessionUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  account_created_at: string;
  provider: "google";
};

type SessionTokenPayload = GoogleSessionUser & {
  exp: number;
};

export function createGoogleAuthorizeUrl(origin: string, mode: "popup" | "redirect"): string {
  const { clientId } = googleOAuthEnv();
  const redirectUri = `${origin}/auth/google/callback`;
  const state = signPayload({
    nonce: randomBytes(16).toString("hex"),
    redirectUri,
    origin,
    mode,
    exp: Date.now() + STATE_TTL_MS,
  } satisfies OAuthStatePayload);

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "openid email profile",
    state,
    access_type: "online",
    prompt: "select_account",
  });

  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  const payload = verifySignedPayload<OAuthStatePayload>(state);
  if (!payload) return null;
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  if (typeof payload.redirectUri !== "string" || typeof payload.origin !== "string") return null;
  return payload;
}

export async function exchangeGoogleCode(code: string, redirectUri: string): Promise<{ access_token: string } | null> {
  const { clientId, clientSecret } = googleOAuthEnv();
  const res = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
      grant_type: "authorization_code",
    }).toString(),
  });
  if (!res.ok) {
    console.error(`Google token exchange failed [${res.status}]: ${await res.text()}`);
    return null;
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) return null;
  return { access_token: data.access_token };
}

export async function fetchGoogleUserInfo(accessToken: string): Promise<GoogleSessionUser | null> {
  const res = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    console.error(`Google userinfo request failed [${res.status}]: ${await res.text()}`);
    return null;
  }
  const data = (await res.json()) as {
    sub?: string;
    email?: string;
    name?: string;
    picture?: string;
  };
  if (!data.sub) return null;
  return {
    id: `google:${data.sub}`,
    email: data.email ?? null,
    full_name: data.name ?? null,
    avatar_url: data.picture ?? null,
    account_created_at: new Date().toISOString(),
    provider: "google",
  };
}

export function createSignedSessionToken(user: GoogleSessionUser): string {
  const payload: SessionTokenPayload = {
    ...user,
    exp: Date.now() + SESSION_TTL_MS,
  };
  return signPayload(payload);
}

export function verifySignedSessionToken(token: string | null | undefined): GoogleSessionUser | null {
  if (!token) return null;
  const payload = verifySignedPayload<SessionTokenPayload>(token);
  if (!payload) return null;
  if (typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
  if (typeof payload.id !== "string" || payload.provider !== "google") return null;
  return {
    id: payload.id,
    email: payload.email ?? null,
    full_name: payload.full_name ?? null,
    avatar_url: payload.avatar_url ?? null,
    account_created_at: payload.account_created_at || new Date().toISOString(),
    provider: "google",
  };
}

function parseCookieValue(cookieHeader: string | null, name: string): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    const k = part.slice(0, idx).trim();
    if (k === name) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export function readSessionFromRequest(request: Request): GoogleSessionUser | null {
  const authHeader = request.headers.get("authorization");
  if (authHeader?.startsWith("Bearer ")) {
    const fromBearer = verifySignedSessionToken(authHeader.slice("Bearer ".length).trim());
    if (fromBearer) return fromBearer;
  }
  const fromCookie = parseCookieValue(request.headers.get("cookie"), SESSION_COOKIE_NAME);
  return verifySignedSessionToken(fromCookie);
}

export function buildSessionCookie(token: string, isHttps: boolean): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(token)}`,
    "Path=/",
    "HttpOnly",
    `Max-Age=${Math.floor(SESSION_TTL_MS / 1000)}`,
    isHttps ? "SameSite=None; Secure" : "SameSite=Lax",
  ];
  return attrs.join("; ");
}

export function buildClearSessionCookie(isHttps: boolean): string {
  const attrs = [
    `${SESSION_COOKIE_NAME}=`,
    "Path=/",
    "HttpOnly",
    "Max-Age=0",
    isHttps ? "SameSite=None; Secure" : "SameSite=Lax",
  ];
  return attrs.join("; ");
}
