import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

const setDoc = vi.fn().mockResolvedValue(undefined);
const updateDoc = vi.fn().mockResolvedValue(undefined);
const getDoc = vi.fn().mockResolvedValue({ exists: () => false });
const getDocFromServer = vi.fn().mockResolvedValue({ exists: () => false });

vi.mock("firebase/app", () => ({
  getApp: vi.fn(),
  getApps: vi.fn(() => [{}]),
  initializeApp: vi.fn(() => ({})),
}));

vi.mock("firebase/auth", () => ({
  GoogleAuthProvider: class {
    setCustomParameters = vi.fn();
  },
  getAuth: vi.fn(() => ({ currentUser: null })),
}));

vi.mock("firebase/firestore", () => ({
  addDoc: vi.fn(),
  collection: vi.fn((_db, name) => ({ path: name })),
  doc: vi.fn((_db, name, id) => ({ path: `${name}/${id}` })),
  getDoc,
  getDocFromServer,
  getDocs: vi.fn(),
  getFirestore: vi.fn(() => ({})),
  initializeFirestore: vi.fn(() => ({})),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  setDoc,
  Timestamp: class {},
  updateDoc,
  where: vi.fn(),
}));

const verifyFirebaseIdToken = vi.fn();
const isFirestoreAdminConfigured = vi.fn().mockResolvedValue(false);
const disconnectMemberDiscord = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/firebase-admin.server", () => ({
  verifyFirebaseIdToken,
  isFirestoreAdminConfigured,
  firestoreGetDoc: vi.fn(),
  firestoreSetDoc: vi.fn(),
  firestoreDeleteDoc: vi.fn(),
  firestoreFindConnectionByDiscordUserId: vi.fn(),
}));

vi.mock("@/lib/discord.server", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/discord.server")>("@/lib/discord.server");
  return {
    ...actual,
    disconnectMemberDiscord,
  };
});

const { ADMIN_EMAIL, isAdminUser, syncUserProfile } = await import("@/lib/firebase");
const { handleIntegrationApiRequest } = await import("@/lib/discord-api.server");

describe("Free City Story Hub access rules", () => {
  beforeEach(() => {
    setDoc.mockClear();
    updateDoc.mockClear();
    getDoc.mockReset();
    getDoc.mockResolvedValue({ exists: () => false });
    verifyFirebaseIdToken.mockReset();
    disconnectMemberDiscord.mockClear();
  });

  it("allows any verified Google/Gmail user to create their own private profile without an allowlist", async () => {
    await syncUserProfile({
      uid: "member_google_123",
      email: "new.player@gmail.com",
      emailVerified: true,
      displayName: "New Player",
      photoURL: "https://example.com/avatar.png",
    } as never);

    expect(setDoc).toHaveBeenCalledTimes(1);
    expect(setDoc).toHaveBeenCalledWith(
      { path: "users/member_google_123" },
      expect.objectContaining({
        uid: "member_google_123",
        email: "new.player@gmail.com",
        fullName: "New Player",
      }),
    );

    const writtenPayload = setDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect("role" in writtenPayload).toBe(false);
    expect("isAdmin" in writtenPayload).toBe(false);
    expect("approved" in writtenPayload).toBe(false);
  });

  it("restricts admin privileges strictly to the verified owner email", () => {
    expect(ADMIN_EMAIL).toBe("michalmark496@gmail.com");
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser({ email: "member@gmail.com", emailVerified: true } as never)).toBe(false);
    expect(isAdminUser({ email: "michalmark496@gmail.com", emailVerified: false } as never)).toBe(
      false,
    );
    expect(isAdminUser({ email: "michalmark496@gmail.com", emailVerified: true } as never)).toBe(
      true,
    );
    expect(isAdminUser({ email: "  MichalMark496@gmail.com ", emailVerified: true } as never)).toBe(
      true,
    );
  });

  it("enforces authentication and admin-only server API checks on /api/integration/status and /api/discord/*", async () => {
    verifyFirebaseIdToken.mockResolvedValueOnce(null);
    const unauthRes = await handleIntegrationApiRequest(
      new Request("http://localhost:3000/api/integration/status", { method: "GET" }),
    );
    expect(unauthRes?.status).toBe(401);

    verifyFirebaseIdToken.mockResolvedValueOnce({
      uid: "regular_uid",
      email: "player@gmail.com",
      emailVerified: true,
    });
    const nonAdminStatusRes = await handleIntegrationApiRequest(
      new Request("http://localhost:3000/api/integration/status", {
        method: "GET",
        headers: { Authorization: "Bearer member-token" },
      }),
    );
    expect(nonAdminStatusRes?.status).toBe(403);

    verifyFirebaseIdToken.mockResolvedValueOnce({
      uid: "regular_uid",
      email: "player@gmail.com",
      emailVerified: true,
    });
    const memberDiscordRes = await handleIntegrationApiRequest(
      new Request("http://localhost:3000/api/discord/disconnect", {
        method: "POST",
        headers: { Authorization: "Bearer member-token" },
      }),
    );
    expect(memberDiscordRes?.status).toBe(200);
    expect(disconnectMemberDiscord).toHaveBeenCalledWith("regular_uid");

    verifyFirebaseIdToken.mockResolvedValueOnce({
      uid: "owner_uid",
      email: "MichalMark496@gmail.com",
      emailVerified: true,
    });
    const adminStatusRes = await handleIntegrationApiRequest(
      new Request("http://localhost:3000/api/integration/status", {
        method: "GET",
        headers: { Authorization: "Bearer admin-token" },
      }),
    );
    expect(adminStatusRes?.status).toBe(200);
  });

  it("enforces owner isolation, admin boundaries, and server-only locks in firestore.rules", () => {
    const rules = readFileSync(resolve(process.cwd(), "firestore.rules"), "utf8");

    expect(rules).toContain("match /{document=**} {\n      allow read, write: if false;\n    }");
    expect(rules).toContain("request.auth.token.email == 'michalmark496@gmail.com'");
    expect(rules).toContain("allow get: if isValidId(userId) && (isOwner(userId) || isAdmin());");
    expect(rules).toContain("allow list: if isAdmin();");
    expect(rules).toContain(
      "data.keys().hasOnly(['uid', 'email', 'fullName', 'avatarUrl', 'createdAt', 'updatedAt'])",
    );
    expect(rules).toContain("match /discordConnections/{userId}");
    expect(rules).toContain(
      "match /discordOAuthStates/{stateHash} {\n      allow read, write: if false;\n    }",
    );
    expect(rules).toContain(
      "match /discordOAuthTokens/{userId} {\n      allow read, write: if false;\n    }",
    );
    expect(rules).toContain(
      "match /admins/{userId} {\n      allow get: if isValidId(userId) && isAdmin();\n      allow list: if false;\n      allow create, update, delete: if false;\n    }",
    );
  });
});
