import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { DiscordButton } from "@/components/site/DiscordButton";
import { DiscordPanel } from "@/components/site/DiscordPanel";
import { DISCORD_INVITE_URL } from "@/lib/site-links";

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("@/lib/firebase", () => ({
  fetchDiscordConnection: vi.fn().mockResolvedValue(null),
  formatFirestoreDate: vi.fn(() => "—"),
}));

const { Route: HomeRoute } = await import("@/routes/index");
const { Route: CommunityRoute } = await import("@/routes/community");

const EXPECTED_INVITE = "https://discord.gg/RXCrsjS7m";

function assertOpensInviteInNewTab(link: HTMLElement) {
  expect(link).toHaveAttribute("href", EXPECTED_INVITE);
  expect(link).toHaveAttribute("target", "_blank");
  const rel = link.getAttribute("rel") ?? "";
  expect(rel).toContain("noopener");
  expect(rel).toContain("noreferrer");
}

describe("Discord invitation links & buttons", () => {
  it("exports the official Free City Discord invite URL", () => {
    expect(DISCORD_INVITE_URL).toBe(EXPECTED_INVITE);
  });

  it("renders DiscordButton pointing to the official invite in a new tab", () => {
    render(<DiscordButton>Join our Discord</DiscordButton>);
    assertOpensInviteInNewTab(screen.getByRole("link", { name: "Join our Discord" }));
  });

  it("connects all three Discord invitation buttons on the homepage (Hero, Getting Started, Final CTA)", () => {
    const Home = HomeRoute.options.component!;
    render(<Home />);

    const joinOurDiscordLinks = screen.getAllByRole("link", { name: "Join our Discord" });
    expect(joinOurDiscordLinks).toHaveLength(2);
    joinOurDiscordLinks.forEach(assertOpensInviteInNewTab);

    const gettingStartedLink = screen.getByRole("link", { name: "Join the Discord" });
    assertOpensInviteInNewTab(gettingStartedLink);
  });

  it("displays and connects the official Discord invite link and button on the Community page", () => {
    const Community = CommunityRoute.options.component!;
    render(<Community />);

    assertOpensInviteInNewTab(screen.getByRole("link", { name: EXPECTED_INVITE }));
    assertOpensInviteInNewTab(screen.getByRole("link", { name: "Join our Discord" }));
  });

  it("connects the Join Free City Discord button in the member dashboard DiscordPanel", () => {
    const queryClient = new QueryClient();
    render(
      <QueryClientProvider client={queryClient}>
        <DiscordPanel userId="test-user" />
      </QueryClientProvider>,
    );

    assertOpensInviteInNewTab(screen.getByRole("link", { name: "Join Free City Discord" }));
  });
});
