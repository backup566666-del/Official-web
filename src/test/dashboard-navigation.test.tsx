import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import type { User } from "firebase/auth";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const signOutMock = vi.fn().mockResolvedValue(undefined);
const navigateMock = vi.fn();
let currentPathname = "/dashboard";

vi.mock("firebase/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("firebase/auth")>();
  return {
    ...actual,
    signOut: signOutMock,
  };
});

vi.mock("@tanstack/react-router", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@tanstack/react-router")>();
  return {
    ...actual,
    Link: ({
      to,
      children,
      onClick,
      ...props
    }: {
      to: string;
      children: ReactNode;
      onClick?: () => void;
    }) => (
      <a
        href={to}
        onClick={(e) => {
          e.preventDefault();
          currentPathname = to;
          onClick?.();
        }}
        {...props}
      >
        {children}
      </a>
    ),
    useNavigate: () => navigateMock,
    useRouterState: ({
      select,
    }: {
      select: (state: { location: { pathname: string } }) => string;
    }) => select({ location: { pathname: currentPathname } }),
  };
});

vi.mock("@/lib/firebase", () => ({
  auth: { name: "mock-auth" },
  fetchMemberApplications: vi.fn().mockResolvedValue([]),
  fetchPublishedEvents: vi.fn().mockResolvedValue([]),
  fetchDiscordConnection: vi.fn().mockResolvedValue(null),
  formatFirestoreDate: vi.fn(() => "—"),
}));

const { DashboardShell } = await import("@/components/dashboard/DashboardShell");
const { DiscordPanel } = await import("@/components/site/DiscordPanel");

const mockUser = {
  uid: "user-123",
  email: "member@example.com",
  emailVerified: true,
  displayName: "Alex Mercer",
  photoURL: null,
  metadata: {
    creationTime: "2026-01-01T00:00:00.000Z",
    lastSignInTime: "2026-11-15T00:00:00.000Z",
  },
} as unknown as User;

const EXPECTED_MENU_LABELS = [
  "Home",
  "My Profile",
  "Server Rules",
  "VIP Membership",
  "Applications",
  "Game Website & Installation",
  "Game Top-up",
  "Cash Top-up",
  "Events",
  "Settings",
  "Support",
];

function renderWithQuery(ui: ReactNode) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(<QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>);
}

describe("Member Dashboard Navigation & Discord Status", () => {
  beforeEach(() => {
    currentPathname = "/dashboard";
    signOutMock.mockClear();
    navigateMock.mockClear();
  });

  it("renders all 11 required sections, Free City logo, Join Discord button, and welcome header in the desktop sidebar", async () => {
    renderWithQuery(
      <DashboardShell user={mockUser}>
        <div>Dashboard Content</div>
      </DashboardShell>,
    );

    const desktopNav = screen.getByRole("navigation", { name: "Dashboard navigation" });
    const links = within(desktopNav).getAllByRole("link");
    expect(links.map((el) => el.textContent?.trim())).toEqual(EXPECTED_MENU_LABELS);

    const sidebar = desktopNav.closest("aside")!;
    expect(sidebar).not.toBeNull();
    expect(within(sidebar).getByRole("link", { name: "Join Free City Discord" })).toHaveAttribute(
      "href",
      "https://discord.gg/RXCrsjS7m",
    );
    expect(within(sidebar).getByRole("button", { name: "Log Out" })).toBeInTheDocument();

    expect(screen.getByText(/Welcome back,/i)).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText(/Google Signed In · Discord Not Connected/i)).toBeInTheDocument();
    });
  });

  it("opens the mobile slide-out drawer from the menu button and closes it after selecting a page", async () => {
    renderWithQuery(
      <DashboardShell user={mockUser}>
        <div>Dashboard Content</div>
      </DashboardShell>,
    );

    const menuButton = screen.getByRole("button", { name: "Open navigation menu" });
    expect(menuButton).toHaveAttribute("aria-expanded", "false");

    fireEvent.click(menuButton);

    const mobileNav = await screen.findByRole("navigation", {
      name: "Mobile dashboard navigation",
    });
    const mobileLinks = within(mobileNav).getAllByRole("link");
    expect(mobileLinks.map((el) => el.textContent?.trim())).toEqual(EXPECTED_MENU_LABELS);

    const drawerDialog = mobileNav.closest('[role="dialog"]') as HTMLElement;
    expect(drawerDialog).not.toBeNull();
    expect(
      within(drawerDialog).getByRole("link", { name: "Join Free City Discord" }),
    ).toHaveAttribute("href", "https://discord.gg/RXCrsjS7m");
    expect(within(drawerDialog).getByRole("button", { name: "Log Out" })).toBeInTheDocument();

    fireEvent.click(within(mobileNav).getByRole("link", { name: "VIP Membership" }));

    await waitFor(() => {
      expect(
        screen.queryByRole("navigation", { name: "Mobile dashboard navigation" }),
      ).not.toBeInTheDocument();
    });
  });

  it("logs out via Firebase Auth and navigates to /login when Log Out is clicked", async () => {
    renderWithQuery(
      <DashboardShell user={mockUser}>
        <div>Dashboard Content</div>
      </DashboardShell>,
    );

    const desktopNav = screen.getByRole("navigation", { name: "Dashboard navigation" });
    const sidebar = desktopNav.closest("aside")!;
    fireEvent.click(within(sidebar).getByRole("button", { name: "Log Out" }));

    await waitFor(() => {
      expect(signOutMock).toHaveBeenCalledTimes(1);
      expect(navigateMock).toHaveBeenCalledWith({ to: "/login", replace: true });
    });
  });

  it("renders Discord as NOT CONNECTED with reserved username, avatar, roles, level, XP, Messages, Premium, AI access, and Connect + Join buttons", async () => {
    renderWithQuery(<DiscordPanel userId="user-123" />);

    await waitFor(() => {
      expect(screen.getByText("Discord Username: Not connected")).toBeInTheDocument();
    });

    expect(screen.getAllByText("NOT CONNECTED").length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText("Discord roles")).toBeInTheDocument();
    expect(screen.getByText("Available after Discord authorization")).toBeInTheDocument();
    expect(screen.getByText("Level")).toBeInTheDocument();
    expect(screen.getByText("XP")).toBeInTheDocument();
    expect(screen.getByText("Messages")).toBeInTheDocument();
    expect(screen.getByText("Premium subscription")).toBeInTheDocument();
    expect(screen.getByText("AI access")).toBeInTheDocument();

    expect(screen.getByRole("button", { name: "Connect Discord Account" })).toBeInTheDocument();

    const inviteLink = screen.getByRole("link", { name: "Join Free City Discord" });
    expect(inviteLink).toHaveAttribute("href", "https://discord.gg/RXCrsjS7m");
    expect(inviteLink).toHaveAttribute("target", "_blank");
  });
});
