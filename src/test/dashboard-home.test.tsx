import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUser = {
  uid: "user-home-1",
  email: "citizen@gmail.com",
  emailVerified: true,
  displayName: "Jordan Vega",
  photoURL: null,
} as unknown as User;

const fetchDiscordConnectionMock = vi.fn();
const fetchMemberApplicationsMock = vi.fn();
const fetchPublishedEventsMock = vi.fn();
const useMemberProfileMock = vi.fn();

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    createFileRoute: () => (options: { component: () => ReactNode }) => ({
      options,
      useRouteContext: () => ({ user: mockUser }),
    }),
    Link: ({ to, children, ...props }: { to: string; children: ReactNode }) => (
      <a href={to} {...props}>
        {children}
      </a>
    ),
  };
});

vi.mock("@/hooks/use-member-profile", () => ({
  profileInitials: (name: string) =>
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join(""),
  useMemberProfile: (...args: unknown[]) => useMemberProfileMock(...args),
}));

vi.mock("@/lib/firebase", () => ({
  auth: { name: "mock-auth", currentUser: null },
  fetchDiscordConnection: (...args: unknown[]) => fetchDiscordConnectionMock(...args),
  fetchMemberApplications: (...args: unknown[]) => fetchMemberApplicationsMock(...args),
  fetchPublishedEvents: (...args: unknown[]) => fetchPublishedEventsMock(...args),
  formatFirestoreDate: vi.fn((val: unknown) => (val ? "Nov 16, 2026" : "—")),
}));

const { Route } = await import("@/routes/_authenticated/dashboard/index");
const DashboardHome = Route.options.component!;

function renderHome() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <DashboardHome />
    </QueryClientProvider>,
  );
}

describe("Logged-in Home Dashboard", () => {
  beforeEach(() => {
    fetchDiscordConnectionMock.mockReset();
    fetchMemberApplicationsMock.mockReset();
    fetchPublishedEventsMock.mockReset();
    useMemberProfileMock.mockReset();
  });

  it("renders Welcome, real account cards, 5 Quick Actions, and omits fake XP/applications/activity when absent", async () => {
    useMemberProfileMock.mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        uid: mockUser.uid,
        email: mockUser.email,
        fullName: "Jordan Vega",
        avatarUrl: null,
        createdAt: { toMillis: () => 1763251200000 },
      },
    });
    fetchDiscordConnectionMock.mockResolvedValue(null);
    fetchMemberApplicationsMock.mockResolvedValue([]);
    fetchPublishedEventsMock.mockResolvedValue([]);

    renderHome();

    expect(screen.getByText("Welcome to Free City")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Jordan Vega" })).toBeInTheDocument();
    expect(screen.getByText("Connected & Verified")).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getAllByText("Not Connected").length).toBeGreaterThanOrEqual(1);
    });
    expect(screen.getByText("Website Member")).toBeInTheDocument();
    expect(screen.getByText("Discord Not Connected")).toBeInTheDocument();

    // Quick Action Cards
    expect(screen.getByRole("link", { name: /^Game Top-up/i })).toHaveAttribute(
      "href",
      "/dashboard/top-up",
    );
    expect(screen.getByRole("link", { name: /^Cash Top-up/i })).toHaveAttribute(
      "href",
      "/dashboard/cash-top-up",
    );
    expect(screen.getByRole("link", { name: /^VIP Membership/i })).toHaveAttribute(
      "href",
      "/dashboard/vip",
    );
    expect(screen.getByRole("link", { name: /^Game Installation/i })).toHaveAttribute(
      "href",
      "/dashboard/game",
    );
    expect(screen.getByRole("link", { name: /^Join Discord/i })).toHaveAttribute(
      "href",
      "https://discord.gg/RXCrsjS7m",
    );

    // Real registration activity appears; synthetic XP/level & Applications/Events sections stay hidden
    expect(screen.getByText("Free City account registered")).toBeInTheDocument();
    expect(screen.queryByText(/Level & XP Progress/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Applications & Events/i)).not.toBeInTheDocument();
  });

  it("renders Level & XP, Applications & Events, and real Discord/bot activity when real data exists", async () => {
    useMemberProfileMock.mockReturnValue({
      isPending: false,
      isError: false,
      data: {
        uid: mockUser.uid,
        email: mockUser.email,
        fullName: "Jordan Vega",
        avatarUrl: null,
        createdAt: { toMillis: () => 1763251200000 },
      },
    });
    fetchDiscordConnectionMock.mockResolvedValue({
      discordUserId: "99887766",
      username: "jordan_rp",
      globalName: "Jordan RP",
      guildStatus: "member",
      guildPending: false,
      level: 14,
      xp: 4820,
      messageCount: 312,
      premiumActive: true,
      premiumTier: "Gold Citizen",
      botSyncStatus: "synced",
      connectedAt: { toMillis: () => 1763252200000 },
      botSyncedAt: { toMillis: () => 1763253200000 },
    });
    fetchMemberApplicationsMock.mockResolvedValue([
      {
        id: "app-1",
        characterName: "Vega Vance",
        discordHandle: "@jordan_rp",
        status: "pending",
        createdAt: { toMillis: () => 1763254200000 },
      },
    ]);
    fetchPublishedEventsMock.mockResolvedValue([
      {
        id: "evt-1",
        title: "Midnight Drift Meet",
        startsAt: "Sat 21:00 UTC",
      },
    ]);

    renderHome();

    await waitFor(() => {
      expect(screen.getByText("Level & XP Progress")).toBeInTheDocument();
    });

    expect(screen.getAllByText("14").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("4820").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("312").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Active · Gold Citizen")).toBeInTheDocument();
    expect(screen.getByText("Applications & Events")).toBeInTheDocument();
    expect(screen.getByText("Discord account connected")).toBeInTheDocument();
    expect(screen.getByText("Free City membership data synchronized")).toBeInTheDocument();
    expect(screen.getByText(/Character application · Vega Vance/i)).toBeInTheDocument();
  });
});
