// Server-only Firebase Auth ID token verifier & Firestore Admin REST client.
// Never import this file from client components.
import { createRemoteJWKSet, importPKCS8, jwtVerify, SignJWT } from "jose";
import { readFileSync } from "node:fs";
import firebaseConfig from "../../firebase-applet-config.json";

const FIREBASE_JWKS = createRemoteJWKSet(
  new URL("https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com"),
);

const PROJECT_ID = firebaseConfig.projectId;
const DATABASE_ID = firebaseConfig.firestoreDatabaseId || "(default)";
const FIRESTORE_DOCUMENTS_BASE = `https://firestore.googleapis.com/v1/projects/${PROJECT_ID}/databases/${DATABASE_ID}/documents`;
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const METADATA_TOKEN_URL =
  "http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token";

export type VerifiedFirebaseUser = {
  uid: string;
  email: string;
  emailVerified: boolean;
};

export async function verifyFirebaseIdToken(authorizationHeader: string | null): Promise<VerifiedFirebaseUser | null> {
  if (!authorizationHeader || !authorizationHeader.startsWith("Bearer ")) return null;
  const token = authorizationHeader.slice("Bearer ".length).trim();
  if (!token || token.length > 8192) return null;

  try {
    const { payload } = await jwtVerify(token, FIREBASE_JWKS, {
      issuer: `https://securetoken.google.com/${PROJECT_ID}`,
      audience: PROJECT_ID,
    });
    const uid = typeof payload.sub === "string" ? payload.sub : "";
    const email = typeof payload["email"] === "string" ? payload["email"] : "";
    const emailVerified = payload["email_verified"] === true;
    if (!uid || !/^[a-zA-Z0-9_-]{1,128}$/.test(uid)) return null;
    if (!emailVerified) return null;
    return { uid, email, emailVerified };
  } catch {
    return null;
  }
}

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
  token_uri?: string;
};

function readServiceAccountFromEnv(): ServiceAccountJson | null {
  const inline = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"]?.trim();
  if (inline) {
    try {
      const parsed = JSON.parse(inline) as Partial<ServiceAccountJson>;
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, "\n"),
          ...(parsed.token_uri ? { token_uri: parsed.token_uri } : {}),
        };
      }
    } catch {
      console.error("Invalid FIREBASE_SERVICE_ACCOUNT_JSON format.");
    }
  }

  const credPath = process.env["GOOGLE_APPLICATION_CREDENTIALS"]?.trim();
  if (credPath) {
    try {
      const raw = readFileSync(credPath, "utf8");
      const parsed = JSON.parse(raw) as Partial<ServiceAccountJson>;
      if (parsed.client_email && parsed.private_key) {
        return {
          client_email: parsed.client_email,
          private_key: parsed.private_key.replace(/\\n/g, "\n"),
          ...(parsed.token_uri ? { token_uri: parsed.token_uri } : {}),
        };
      }
    } catch {
      // Ignore unreadable credentials path; fall back to metadata server if available.
    }
  }
  return null;
}

let cachedGoogleToken: { token: string; expiresAtMs: number } | null = null;

async function getGoogleAccessToken(): Promise<string | null> {
  if (cachedGoogleToken && cachedGoogleToken.expiresAtMs - Date.now() > 60_000) {
    return cachedGoogleToken.token;
  }

  const sa = readServiceAccountFromEnv();
  if (sa) {
    const key = await importPKCS8(sa.private_key, "RS256");
    const tokenUri = sa.token_uri || GOOGLE_TOKEN_URL;
    const assertion = await new SignJWT({
      scope: "https://www.googleapis.com/auth/datastore",
    })
      .setProtectedHeader({ alg: "RS256", typ: "JWT" })
      .setIssuer(sa.client_email)
      .setSubject(sa.client_email)
      .setAudience(tokenUri)
      .setIssuedAt()
      .setExpirationTime("55m")
      .sign(key);

    const res = await fetch(tokenUri, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion,
      }).toString(),
      signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) {
      console.error(`Google OAuth token exchange failed [${res.status}]: ${await res.text()}`);
      return null;
    }

    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) return null;
    cachedGoogleToken = {
      token: body.access_token,
      expiresAtMs: Date.now() + (body.expires_in ?? 3300) * 1000,
    };
    return cachedGoogleToken.token;
  }

  // Fallback: Cloud Run / GCE metadata server Application Default Credentials
  try {
    const res = await fetch(METADATA_TOKEN_URL, {
      headers: { "Metadata-Flavor": "Google" },
      signal: AbortSignal.timeout(2000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { access_token?: string; expires_in?: number };
    if (!body.access_token) return null;
    cachedGoogleToken = {
      token: body.access_token,
      expiresAtMs: Date.now() + (body.expires_in ?? 3000) * 1000,
    };
    return cachedGoogleToken.token;
  } catch {
    return null;
  }
}

export async function isFirestoreAdminConfigured(): Promise<boolean> {
  if (readServiceAccountFromEnv()) return true;
  const token = await getGoogleAccessToken();
  return Boolean(token);
}

type FirestoreValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreValue> } };

const ISO_TIMESTAMP_FIELDS = new Set(["createdAt", "updatedAt", "connectedAt", "guildCheckedAt", "botSyncedAt"]);

function encodeValue(key: string, value: unknown): FirestoreValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return { nullValue: null };
  if (typeof value === "boolean") return { booleanValue: value };
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return undefined;
    return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  }
  if (typeof value === "string") {
    if (ISO_TIMESTAMP_FIELDS.has(key) && !Number.isNaN(Date.parse(value))) {
      return { timestampValue: new Date(value).toISOString() };
    }
    return { stringValue: value };
  }
  if (value instanceof Date) {
    return { timestampValue: value.toISOString() };
  }
  if (Array.isArray(value)) {
    const values = value
      .map((item) => encodeValue("", item))
      .filter((item): item is FirestoreValue => item !== undefined);
    return { arrayValue: { values } };
  }
  if (typeof value === "object") {
    const fields: Record<string, FirestoreValue> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      const encoded = encodeValue(k, v);
      if (encoded !== undefined) fields[k] = encoded;
    }
    return { mapValue: { fields } };
  }
  return undefined;
}

function decodeValue(v: FirestoreValue): unknown {
  if ("stringValue" in v) return v.stringValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("nullValue" in v) return null;
  if ("arrayValue" in v) return (v.arrayValue.values ?? []).map(decodeValue);
  if ("mapValue" in v) {
    const out: Record<string, unknown> = {};
    for (const [k, child] of Object.entries(v.mapValue.fields ?? {})) {
      out[k] = decodeValue(child);
    }
    return out;
  }
  return undefined;
}

function encodeDocFields(data: Record<string, unknown>): Record<string, FirestoreValue> {
  const fields: Record<string, FirestoreValue> = {};
  for (const [key, value] of Object.entries(data)) {
    const encoded = encodeValue(key, value);
    if (encoded !== undefined) fields[key] = encoded;
  }
  return fields;
}

function decodeDocFields<T extends Record<string, unknown>>(fields?: Record<string, FirestoreValue>): T {
  const out: Record<string, unknown> = {};
  if (!fields) return out as T;
  for (const [key, value] of Object.entries(fields)) {
    out[key] = decodeValue(value);
  }
  return out as T;
}

async function requireGoogleAccessToken(): Promise<string> {
  const token = await getGoogleAccessToken();
  if (!token) {
    throw new Error(
      "Server Firestore credentials are not configured. Set FIREBASE_SERVICE_ACCOUNT_JSON on the backend or run on Google Cloud with Firestore access.",
    );
  }
  return token;
}

export async function firestoreGetDoc<T extends Record<string, unknown>>(
  collection: string,
  docId: string,
): Promise<T | null> {
  const token = await requireGoogleAccessToken();
  const url = `${FIRESTORE_DOCUMENTS_BASE}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(`Firestore read failed [${res.status}]: ${await res.text()}`);
  }
  const body = (await res.json()) as { fields?: Record<string, FirestoreValue> };
  return decodeDocFields<T>(body.fields);
}

export async function firestoreSetDoc(
  collection: string,
  docId: string,
  data: Record<string, unknown>,
): Promise<void> {
  const token = await requireGoogleAccessToken();
  const url = `${FIRESTORE_DOCUMENTS_BASE}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: encodeDocFields(data) }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Firestore write failed [${res.status}]: ${await res.text()}`);
  }
}

export async function firestoreDeleteDoc(collection: string, docId: string): Promise<void> {
  const token = await requireGoogleAccessToken();
  const url = `${FIRESTORE_DOCUMENTS_BASE}/${encodeURIComponent(collection)}/${encodeURIComponent(docId)}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
    signal: AbortSignal.timeout(8000),
  });
  if (res.status === 404) return;
  if (!res.ok) {
    throw new Error(`Firestore delete failed [${res.status}]: ${await res.text()}`);
  }
}

export async function firestoreFindConnectionByDiscordUserId(
  discordUserId: string,
): Promise<{ userId: string } | null> {
  const token = await requireGoogleAccessToken();
  const url = `${FIRESTORE_DOCUMENTS_BASE}:runQuery`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: "discordConnections" }],
        where: {
          fieldFilter: {
            field: { fieldPath: "discordUserId" },
            op: "EQUAL",
            value: { stringValue: discordUserId },
          },
        },
        limit: 1,
      },
    }),
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Firestore query failed [${res.status}]: ${await res.text()}`);
  }
  const rows = (await res.json()) as Array<{ document?: { fields?: Record<string, FirestoreValue> } }>;
  const first = rows.find((r) => r.document?.fields);
  if (!first?.document?.fields) return null;
  const decoded = decodeDocFields<{ userId?: unknown }>(first.document.fields);
  return typeof decoded.userId === "string" ? { userId: decoded.userId } : null;
}
