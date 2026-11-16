import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const sessionState: { user: { uid: string; email: string } | null; ready: boolean } = {
  user: null,
  ready: true,
};

vi.mock("@/hooks/use-session-user", () => ({
  useSessionUser: () => sessionState,
}));

const { CityBackground } = await import("@/components/site/CityBackground");

describe("CityBackground auth-state switching", () => {
  beforeEach(() => {
    sessionState.user = null;
    sessionState.ready = true;
  });

  it("renders the unchanged public website background for logged-out visitors", () => {
    const { container } = render(<CityBackground />);
    const wrapper = container.querySelector('[data-background-mode="public"]');
    expect(wrapper).not.toBeNull();
    expect(container.querySelector('[data-background-mode="member"]')).toBeNull();
  });

  it("switches to the dedicated member dashboard background when signed in", () => {
    sessionState.user = { uid: "member-1", email: "member@gmail.com" };
    const { container } = render(<CityBackground />);
    const wrapper = container.querySelector('[data-background-mode="member"]');
    expect(wrapper).not.toBeNull();
    expect(container.querySelector('[data-background-mode="public"]')).toBeNull();
  });
});
