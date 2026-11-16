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
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} from "firebase/firestore";
import firebaseConfig from "../../firebase-applet-config.json";

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
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

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
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
  return Boolean(user && user.emailVerified && user.email === ADMIN_EMAIL);
}

export function formatFirestoreDate(value: unknown): string {
  if (!value) return "—";
  if (value instanceof Timestamp) {
    return value.toDate().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: unknown }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
  }
  if (typeof value === "string") {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
    }
  }
  return "—";
}

function toMillis(value: unknown): number {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "object" && value !== null && "toMillis" in value && typeof (value as { toMillis: unknown }).toMillis === "function") {
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
    handleFirestoreError(error, OperationType.WRITE, path);
  }
}

export async function fetchUserProfile(uid: string): Promise<UserProfileDoc | null> {
  const path = `users/${uid}`;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    return snap.exists() ? (snap.data() as UserProfileDoc) : null;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export async function fetchDiscordConnection(uid: string): Promise<DiscordConnectionDoc | null> {
  const path = `discordConnections/${uid}`;
  try {
    const snap = await getDoc(doc(db, "discordConnections", uid));
    return snap.exists() ? (snap.data() as DiscordConnectionDoc) : null;
  } catch (error) {
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
