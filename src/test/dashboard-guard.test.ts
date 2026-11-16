import { describe, expect, it, vi } from "vitest";
import { isRedirect } from "@tanstack/react-router";

const mockAuth: {
  authStateReady: ReturnType<typeof vi.fn>;
  currentUser: { uid: string; email: string } | null;
} = {
  authStateReady: vi.fn().mockResolvedValue(undefined),
  currentUser: null,
};

vi.mock("@/lib/firebase", () => ({ auth: mockAuth }));

const { Route } = await import("@/routes/_authenticated/route");
const beforeLoad = Route.options.beforeLoad as unknown as () => Promise<unknown>;

describe("Members-only area", () => {
  it("sends signed-out visitors to the login page", async () => {
    mockAuth.currentUser = null;
    const err = (await beforeLoad().catch((e: unknown) => e)) as { options: { to: string } };
    expect(isRedirect(err)).toBe(true);
    expect(err.options.to).toBe("/login");
  });

  it("lets signed-in members through", async () => {
    mockAuth.currentUser = { uid: "u1", email: "member@example.com" };
    await expect(beforeLoad()).resolves.toEqual({ user: { uid: "u1", email: "member@example.com" } });
  });
});
