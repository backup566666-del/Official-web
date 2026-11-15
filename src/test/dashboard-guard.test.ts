import { describe, expect, it, vi } from "vitest";
import { isRedirect } from "@tanstack/react-router";

const getUser = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser } } }));

const { Route } = await import("@/routes/_authenticated/route");
const beforeLoad = Route.options.beforeLoad as unknown as () => Promise<unknown>;

describe("Members-only area", () => {
  it("sends signed-out visitors to the login page", async () => {
    getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const err = (await beforeLoad().catch((e: unknown) => e)) as { options: { to: string } };
    expect(isRedirect(err)).toBe(true);
    expect(err.options.to).toBe("/login");
  });

  it("lets signed-in members through", async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: "u1" } }, error: null });
    await expect(beforeLoad()).resolves.toEqual({ user: { id: "u1" } });
  });
});
