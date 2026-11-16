import { getApp, getApps, initializeApp } from "firebase/app";
import { GoogleAuthProvider, getAuth, type User } from "firebase/auth";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  getFirestore,
  initializeFirestore,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
  type Firestore,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

function createFirestoreDb(): Firestore {
  if (typeof window === "undefined" || typeof initializeFirestore !== "function") {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
  try {
    return initializeFirestore(
      app,
      {
        experimentalAutoDetectLongPolling: true,
      },
      firebaseConfig.firestoreDatabaseId,
    );
  } catch {
    return getFirestore(app, firebaseConfig.firestoreDatabaseId);
  }
}

export const db = createFirestoreDb();
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

export enum OperationType {
  CREATE = "create",
  UPDATE = "update",
  DELETE = "delete",
  LIST = "list",
  GET = "get",
  WRITE = "write",
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null | undefined;
    email?: string | null | undefined;
    emailVerified?: boolean | null | undefined;
    isAnonymous?: boolean | null | undefined;
    tenantId?: string | null | undefined;
    providerInfo?: {
      providerId?: string | null | undefined;
      email?: string | null | undefined;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null,
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error("Firestore Error: ", JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

function isUnavailableError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? String((error as { code: unknown }).code) : "";
  const message = error instanceof Error ? error.message : String(error);
  return (
    code === "unavailable" ||
    message.includes("client is offline") ||
    message.includes("Could not reach Cloud Firestore backend")
  );
}

type FirestoreRestValue =
  | { stringValue: string }
  | { integerValue: string }
  | { doubleValue: number }
  | { booleanValue: boolean }
  | { timestampValue: string }
  | { nullValue: null }
  | { arrayValue: { values?: FirestoreRestValue[] } }
  | { mapValue: { fields?: Record<string, FirestoreRestValue> } };

function decodeRestValue(value: FirestoreRestValue): unknown {
  if ("stringValue" in value) return value.stringValue;
  if ("timestampValue" in value) return value.timestampValue;
  if ("booleanValue" in value) return value.booleanValue;
  if ("integerValue" in value) return Number(value.integerValue);
  if ("doubleValue" in value) return value.doubleValue;
  if ("nullValue" in value) return null;
  if ("arrayValue" in value) return (value.arrayValue.values ?? []).map(decodeRestValue);
  if ("mapValue" in value) {
    const out: Record<string, unknown> = {};
    for (const [k, child] of Object.entries(value.mapValue.fields ?? {})) {
      out[k] = decodeRestValue(child);
    }
    return out;
  }
  return undefined;
}

function decodeRestFields<T extends Record<string, unknown>>(
  fields?: Record<string, FirestoreRestValue>,
): T {
  const out: Record<string, unknown> = {};
  if (!fields) return out as T;
  for (const [key, value] of Object.entries(fields)) {
    out[key] = decodeRestValue(value);
  }
  return out as T;
}

function firestoreRestDocumentsBase(): string {
  const databaseId = firebaseConfig.firestoreDatabaseId || "(default)";
  return `https://firestore.googleapis.com/v1/projects/${firebaseConfig.projectId}/databases/${databaseId}/documents`;
}

async function getRestAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};
  const currentUser = auth.currentUser;
  if (currentUser && typeof currentUser.getIdToken === "function") {
    try {
      const token = await currentUser.getIdToken();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    } catch {
      // Proceed without token for public queries (e.g., published events).
    }
  }
  return headers;
}

async function restGetDoc<T extends Record<string, unknown>>(
  collectionName: string,
  docId: string,
  path: string,
): Promise<T | null> {
  const url = `${firestoreRestDocumentsBase()}/${encodeURIComponent(collectionName)}/${encodeURIComponent(docId)}?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
  const headers = await getRestAuthHeaders();
  const res = await fetch(url, { headers });
  if (res.status === 404) return null;
  if (res.status === 403) {
    handleFirestoreError(
      new Error("Missing or insufficient permissions."),
      OperationType.GET,
      path,
    );
  }
  if (!res.ok) {
    throw new Error(`Firestore request failed (${res.status}).`);
  }
  const body = (await res.json()) as { fields?: Record<string, FirestoreRestValue> };
  return decodeRestFields<T>(body.fields);
}

async function restRunQuery<T extends Record<string, unknown>>(
  collectionName: string,
  fieldPath: string,
  value: string | boolean,
  path: string,
): Promise<Array<T & { id: string }>> {
  const url = `${firestoreRestDocumentsBase()}:runQuery?key=${encodeURIComponent(firebaseConfig.apiKey)}`;
  const headers = {
    ...(await getRestAuthHeaders()),
    "Content-Type": "application/json",
  };
  const restVal = typeof value === "boolean" ? { booleanValue: value } : { stringValue: value };
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({
      structuredQuery: {
        from: [{ collectionId: collectionName }],
        where: {
          fieldFilter: {
            field: { fieldPath },
            op: "EQUAL",
            value: restVal,
          },
        },
      },
    }),
  });
  if (res.status === 403) {
    handleFirestoreError(
      new Error("Missing or insufficient permissions."),
      OperationType.LIST,
      path,
    );
  }
  if (!res.ok) {
    throw new Error(`Firestore query failed (${res.status}).`);
  }
  const rows = (await res.json()) as Array<{
    document?: { name?: string; fields?: Record<string, FirestoreRestValue> };
  }>;
  return rows
    .filter((row) => Boolean(row.document?.fields))
    .map((row) => {
      const fullName = row.document?.name ?? "";
      const id = fullName.split("/").pop() ?? "";
      return { id, ...decodeRestFields<T>(row.document?.fields) };
    });
}

async function testConnection() {
  if (typeof window === "undefined") return;
  try {
    await getDocFromServer(doc(db, "test", "connection"));
  } catch (error) {
    if (error instanceof Error && error.message.includes("the client is offline")) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
void testConnection();

export type UserProfileDoc = {
  uid: string;
  email: string;
  fullName?: string;
  avatarUrl?: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
};

export type CommunityEventDoc = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  location?: string;
  published: boolean;
  createdBy: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
};

export type MemberApplicationDoc = {
  id: string;
  userId: string;
  characterName: string;
  discordHandle: string;
  backstory: string;
  status: "pending" | "approved" | "rejected";
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
};

export type BotSyncStatus = "not_configured" | "synced" | "not_found" | "error";

export type DiscordConnectionDoc = {
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
  guildCheckedAt?: Timestamp | string;
  botSyncedAt?: Timestamp | string;
  botSyncStatus?: BotSyncStatus;
  connectedAt: Timestamp | string;
  updatedAt: Timestamp | string;
};

export const ADMIN_EMAIL = "michalmark496@gmail.com";

export function isAdminUser(user: User | null | undefined): boolean {
  return Boolean(user && user.emailVerified && user.email?.trim().toLowerCase() === ADMIN_EMAIL);
}

export function formatFirestoreDate(value: unknown): string {
  if (!value) return "—";
  if (value instanceof Timestamp) {
    return value
      .toDate()
      .toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }
  if (
    typeof value === "object" &&
    value !== null &&
    "toDate" in value &&
    typeof (value as { toDate: unknown }).toDate === "function"
  ) {
    return (value as { toDate: () => Date })
      .toDate()
      .toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    }
  }
  return "—";
}

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? 0 : ms;
  }
  return 0;
}

export async function syncUserProfile(user: User): Promise<void> {
  if (!user.email || !user.emailVerified) return;
  const path = `users/${user.uid}`;
  const ref = doc(db, "users", user.uid);

  const fullName = user.displayName?.trim().slice(0, 120);
  const avatarUrl = user.photoURL?.trim().slice(0, 1000);
  const email = user.email.trim().slice(0, 254);

  try {
    const existing = await getDoc(ref);
    if (!existing.exists()) {
      await setDoc(ref, {
        uid: user.uid,
        email,
        ...(fullName ? { fullName } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    } else {
      await updateDoc(ref, {
        email,
        ...(fullName ? { fullName } : {}),
        ...(avatarUrl ? { avatarUrl } : {}),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    if (isUnavailableError(error)) {
      return;
    }
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserProfile(uid: string): Promise<UserProfileDoc | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data() as UserProfileDoc) : null;
  } catch (error) {
    if (isUnavailableError(error)) {
      return await restGetDoc<UserProfileDoc>("users", uid, path);
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchDiscordConnection(uid: string): Promise<DiscordConnectionDoc | null> {
  const path = `discordConnections/${uid}`;
  try {
    const snap = await getDoc(doc(db, "discordConnections", uid));
    return snap.exists() ? (snap.data() as DiscordConnectionDoc) : null;
  } catch (error) {
    if (isUnavailableError(error)) {
      return await restGetDoc<DiscordConnectionDoc>("discordConnections", uid, path);
    }
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchPublishedEvents(): Promise<CommunityEventDoc[]> {
  const path = "events";
  try {
    const q = query(collection(db, "events"), where("published", "==", true));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<CommunityEventDoc, "id">) }))
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  } catch (error) {
    if (isUnavailableError(error)) {
      const items = await restRunQuery<Omit<CommunityEventDoc, "id">>(
        "events",
        "published",
        true,
        path,
      );
      return items.sort((a, b) => String(a.startsAt ?? "").localeCompare(String(b.startsAt ?? "")));
    }
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function publishCommunityEvent(
  uid: string,
  input: { title: string; description: string; startsAt: string; location?: string },
): Promise<string> {
  const path = "events";
  const title = input.title.trim().slice(0, 140);
  const description = input.description.trim().slice(0, 2000);
  const startsAt = input.startsAt.trim().slice(0, 64);
  const location = input.location?.trim().slice(0, 160);

  if (title.length < 2) throw new Error("Event title must be at least 2 characters.");
  if (description.length < 5) throw new Error("Event description must be at least 5 characters.");
  if (startsAt.length < 4) throw new Error("Please enter an event date/time.");

  try {
    const docRef = await addDoc(collection(db, "events"), {
      title,
      description,
      startsAt,
      ...(location ? { location } : {}),
      published: true,
      createdBy: uid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}

export async function fetchMemberApplications(uid: string): Promise<MemberApplicationDoc[]> {
  const path = "applications";
  try {
    const q = query(collection(db, "applications"), where("userId", "==", uid));
    const snap = await getDocs(q);
    return snap.docs
      .map((d) => ({ id: d.id, ...(d.data() as Omit<MemberApplicationDoc, "id">) }))
      .sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
  } catch (error) {
    if (isUnavailableError(error)) {
      const items = await restRunQuery<Omit<MemberApplicationDoc, "id">>(
        "applications",
        "userId",
        uid,
        path,
      );
      return items.sort((a, b) => toMillis(b.createdAt) - toMillis(a.createdAt));
    }
    handleFirestoreError(error, OperationType.LIST, path);
  }
}

export async function submitMemberApplication(
  uid: string,
  input: { characterName: string; discordHandle: string; backstory: string },
): Promise<string> {
  const path = "applications";
  const characterName = input.characterName.trim().slice(0, 80);
  const discordHandle = input.discordHandle.trim().slice(0, 80);
  const backstory = input.backstory.trim().slice(0, 2000);

  if (characterName.length < 2) throw new Error("Character name must be at least 2 characters.");
  if (discordHandle.length < 2) throw new Error("Discord handle must be at least 2 characters.");
  if (backstory.length < 20) throw new Error("Character backstory must be at least 20 characters.");

  try {
    const docRef = await addDoc(collection(db, "applications"), {
      userId: uid,
      characterName,
      discordHandle,
      backstory,
      status: "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
  }
}
