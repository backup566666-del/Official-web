import { describe, expect, it, vi } from "vitest";
import blueprint from "../../firebase-blueprint.json";

const addDoc = vi.fn().mockResolvedValue({ id: "doc_1" });
const getDoc = vi.fn();
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
  getAuth: vi.fn(() => ({
    currentUser: {
      uid: "uid_1",
      email: "member@gmail.com",
      emailVerified: true,
      getIdToken: vi.fn().mockResolvedValue("mock-id-token"),
    },
  })),
}));

vi.mock("firebase/firestore", () => ({
  addDoc,
  collection: vi.fn((_db, name) => ({ path: name })),
  doc: vi.fn((_db, name, id) => ({ path: `${name}/${id}` })),
  getDoc,
  getDocFromServer,
  getDocs: vi.fn(),
  getFirestore: vi.fn(() => ({})),
  initializeFirestore: vi.fn(() => ({})),
  query: vi.fn(),
  serverTimestamp: vi.fn(() => "SERVER_TIMESTAMP"),
  setDoc: vi.fn(),
  Timestamp: class {},
  updateDoc: vi.fn(),
  where: vi.fn(),
}));

const {
  ADMIN_EMAIL,
  fetchDiscordConnection,
  formatFirestoreDate,
  isAdminUser,
  publishCommunityEvent,
  submitMemberApplication,
} = await import("@/lib/firebase");

describe("Firebase blueprint & Firestore validation", () => {
  it("defines the expected Firestore collections in firebase-blueprint.json", () => {
    expect(Object.keys(blueprint.firestore)).toEqual([
      "/users/{userId}",
      "/discordConnections/{userId}",
      "/discordOAuthStates/{stateHash}",
      "/discordOAuthTokens/{userId}",
      "/events/{eventId}",
      "/applications/{applicationId}",
      "/admins/{userId}",
    ]);
  });

  it("recognizes verified admin account only when email is verified and matches ADMIN_EMAIL", () => {
    expect(isAdminUser(null)).toBe(false);
    expect(isAdminUser({ email: ADMIN_EMAIL, emailVerified: false } as never)).toBe(false);
    expect(isAdminUser({ email: "other@example.com", emailVerified: true } as never)).toBe(false);
    expect(isAdminUser({ email: ADMIN_EMAIL, emailVerified: true } as never)).toBe(true);
  });

  it("enforces member application field bounds before writing to Firestore", async () => {
    await expect(
      submitMemberApplication("uid_1", {
        characterName: "A",
        discordHandle: "user",
        backstory: "Long enough backstory for Free City roleplay.",
      }),
    ).rejects.toThrow("Character name must be at least 2 characters.");

    await expect(
      submitMemberApplication("uid_1", {
        characterName: "Elena Vance",
        discordHandle: "elena",
        backstory: "Too short",
      }),
    ).rejects.toThrow("Character backstory must be at least 20 characters.");

    addDoc.mockClear();
    const id = await submitMemberApplication("uid_1", {
      characterName: "Elena Vance",
      discordHandle: "elenavance",
      backstory: "Former dockside mechanic looking for a fresh start in Free City.",
    });
    expect(id).toBe("doc_1");
    expect(addDoc).toHaveBeenCalledWith(
      { path: "applications" },
      expect.objectContaining({
        userId: "uid_1",
        characterName: "Elena Vance",
        discordHandle: "elenavance",
        status: "pending",
      }),
    );
  });

  it("enforces event validation and omits empty optional location", async () => {
    addDoc.mockClear();
    await publishCommunityEvent("admin_uid", {
      title: "Midnight Meet",
      startsAt: "2026-12-01 20:00 UTC",
      description: "Community meetup at Del Perro Pier.",
      location: "   ",
    });
    const payload = addDoc.mock.calls[0]?.[1] as Record<string, unknown>;
    expect(payload["published"]).toBe(true);
    expect("location" in payload).toBe(false);
  });

  it("formats Firestore date strings safely", () => {
    expect(formatFirestoreDate("")).toBe("—");
    expect(formatFirestoreDate("not-a-date")).toBe("—");
    expect(formatFirestoreDate("2026-01-15T00:00:00Z")).not.toBe("—");
  });

  it("falls back to authenticated Firestore REST API when getDoc fails because client is offline", async () => {
    getDoc.mockRejectedValueOnce(
      Object.assign(new Error("Failed to get document because the client is offline."), {
        code: "unavailable",
      }),
    );
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response("{}", { status: 404 }));

    await expect(fetchDiscordConnection("uid_1")).resolves.toBeNull();
    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("/documents/discordConnections/uid_1"),
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer mock-id-token" }),
      }),
    );

    getDoc.mockRejectedValueOnce(
      Object.assign(new Error("Failed to get document because the client is offline."), {
        code: "unavailable",
      }),
    );
    fetchSpy.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          fields: {
            userId: { stringValue: "uid_1" },
            discordUserId: { stringValue: "99887766" },
            username: { stringValue: "citizen" },
            guildStatus: { stringValue: "member" },
            guildPending: { booleanValue: false },
            xp: { integerValue: "420" },
          },
        }),
        { status: 200 },
      ),
    );

    await expect(fetchDiscordConnection("uid_1")).resolves.toEqual({
      userId: "uid_1",
      discordUserId: "99887766",
      username: "citizen",
      guildStatus: "member",
      guildPending: false,
      xp: 420,
    });

    fetchSpy.mockRestore();
  });

  it("still reports FirestoreErrorInfo JSON when permission is denied", async () => {
    getDoc.mockRejectedValueOnce(
      Object.assign(new Error("Missing or insufficient permissions."), {
        code: "permission-denied",
      }),
    );
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await expect(fetchDiscordConnection("uid_other")).rejects.toThrow(
      '"operationType":"get","path":"discordConnections/uid_other"',
    );
    errSpy.mockRestore();
  });
});
