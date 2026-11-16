import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { signOut, type User } from "firebase/auth";
import {
  Bell,
  CalendarDays,
  ChevronDown,
  Crown,
  ExternalLink,
  FileText,
  Gamepad2,
  Home,
  LifeBuoy,
  LogOut,
  Menu,
  ScrollText,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetDescription, SheetTitle } from "@/components/ui/sheet";
import { auth, fetchMemberApplications, fetchPublishedEvents, formatFirestoreDate } from "@/lib/firebase";
import { cn } from "@/lib/utils";

export type DashboardNavItem = {
  to:
    | "/dashboard"
    | "/dashboard/profile"
    | "/dashboard/rules"
    | "/dashboard/vip"
    | "/dashboard/applications"
    | "/dashboard/game"
    | "/dashboard/events"
    | "/dashboard/settings"
    | "/dashboard/support";
  label: string;
  icon: LucideIcon;
};

export const DASHBOARD_NAV_ITEMS: readonly DashboardNavItem[] = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/dashboard/profile", label: "My Profile", icon: UserRound },
  { to: "/dashboard/rules", label: "Server Rules", icon: ScrollText },
  { to: "/dashboard/vip", label: "VIP Membership", icon: Crown },
  { to: "/dashboard/applications", label: "Applications", icon: FileText },
  { to: "/dashboard/game", label: "Game Website & Installation", icon: Gamepad2 },
  { to: "/dashboard/events", label: "Events", icon: CalendarDays },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
  { to: "/dashboard/support", label: "Support", icon: LifeBuoy },
];

function userInitials(user: User): string {
  const source = user.displayName || user.email || "FC";
  return source
    .split(/[\s@._-]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function isNavItemActive(pathname: string, to: DashboardNavItem["to"]): boolean {
  if (to === "/dashboard") {
    return pathname === "/dashboard" || pathname === "/dashboard/";
  }
  return pathname === to || pathname.startsWith(`${to}/`);
}

function NotificationsPopover({ userId }: { userId: string }) {
  const applicationsQuery = useQuery({
    queryKey: ["applications", userId],
    queryFn: () => fetchMemberApplications(userId),
  });
  const eventsQuery = useQuery({
    queryKey: ["published-events"],
    queryFn: fetchPublishedEvents,
  });

  const applications = applicationsQuery.data ?? [];
  const events = eventsQuery.data ?? [];
  const itemCount = applications.length + events.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Notifications"
          className="relative flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full border border-glass-border bg-white/5 text-foreground transition-colors hover:border-electric/60 hover:text-electric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="h-4 w-4" />
          {itemCount > 0 && (
            <span className="sr-only">{itemCount} updates</span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="glass-strong w-80 rounded-2xl border border-glass-border p-4 text-foreground">
        <div className="flex items-center justify-between border-b border-glass-border pb-3">
          <p className="font-display text-lg font-extrabold uppercase tracking-wide">Notifications</p>
          <span className="text-xs text-muted-foreground tabular-nums">{itemCount} updates</span>
        </div>

        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {applicationsQuery.isPending || eventsQuery.isPending ? (
            <p className="py-3 text-sm text-muted-foreground">Checking updates…</p>
          ) : itemCount === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              You have no notifications yet. Application status updates and published events will appear here.
            </p>
          ) : (
            <>
              {applications.slice(0, 3).map((app) => (
                <Link
                  key={app.id}
                  to="/dashboard/applications"
                  className="block rounded-xl border border-glass-border px-3 py-2.5 text-sm transition-colors hover:border-electric/50"
                >
                  <p className="font-semibold text-foreground">{app.characterName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Application status: <span className="uppercase text-electric">{app.status}</span> ·{" "}
                    {formatFirestoreDate(app.createdAt)}
                  </p>
                </Link>
              ))}
              {events.slice(0, 3).map((ev) => (
                <Link
                  key={ev.id}
                  to="/dashboard/events"
                  className="block rounded-xl border border-glass-border px-3 py-2.5 text-sm transition-colors hover:border-electric/50"
                >
                  <p className="font-semibold text-foreground">{ev.title}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Event · {ev.startsAt}</p>
                </Link>
              ))}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function DashboardShell({ user, children }: { user: User; children: ReactNode }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  // Always close mobile navigation drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const currentNav =
    DASHBOARD_NAV_ITEMS.find((item) => isNavItemActive(pathname, item.to)) ?? DASHBOARD_NAV_ITEMS[0]!;

  const displayName = user.displayName || user.email || "Member";

  async function handleLogout() {
    if (signingOut) return;
    setSigningOut(true);
    setDrawerOpen(false);
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut(auth);
    navigate({ to: "/login", replace: true });
  }

  return (
    <div className="min-h-[100svh] lg:flex">
      {/* Mobile Slide-Out Navigation Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent
          side="left"
          className="glass-strong flex w-[85vw] max-w-xs flex-col border-r border-glass-border p-0 text-foreground"
        >
          <div className="border-b border-glass-border px-5 py-4 pr-12">
            <SheetTitle className="font-display text-2xl font-black uppercase tracking-[0.22em] text-foreground">
              Free City
            </SheetTitle>
            <SheetDescription className="mt-0.5 text-xs font-semibold uppercase tracking-[0.25em] text-electric">
              Member Navigation
            </SheetDescription>
          </div>

          <nav aria-label="Mobile dashboard navigation" className="flex-1 overflow-y-auto px-3 py-4">
            <ul className="space-y-1.5">
              {DASHBOARD_NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const active = isNavItemActive(pathname, item.to);
                return (
                  <li key={item.to}>
                    <Link
                      to={item.to}
                      onClick={() => setDrawerOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex min-h-[46px] items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all",
                        active
                          ? "border-neon/60 bg-neon/15 text-foreground shadow-neon"
                          : "border-transparent text-muted-foreground hover:border-glass-border hover:bg-white/5 hover:text-foreground",
                      )}
                    >
                      <Icon className={cn("h-4 w-4 shrink-0", active ? "text-electric" : "text-muted-foreground")} />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="border-t border-glass-border p-3 space-y-2">
            <Link
              to="/"
              onClick={() => setDrawerOpen(false)}
              className="flex min-h-[44px] items-center justify-between rounded-xl px-3.5 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:bg-white/5 hover:text-foreground"
            >
              <span>Public Website</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="flex min-h-[46px] w-full cursor-pointer items-center gap-3 rounded-xl border border-glass-border bg-white/5 px-3.5 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:border-destructive/60 hover:bg-destructive/15 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4 shrink-0 text-electric" />
              <span>{signingOut ? "Logging out…" : "Log Out"}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Left-Hand Navigation Sidebar */}
      <aside className="glass-strong hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col lg:border-r lg:border-glass-border">
        <div className="border-b border-glass-border px-6 py-5">
          <Link
            to="/"
            className="block font-display text-2xl font-black uppercase tracking-[0.26em] text-foreground transition-colors hover:text-electric"
          >
            Free City
          </Link>
          <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.3em] text-electric">Member Dashboard</p>
        </div>

        <nav aria-label="Dashboard navigation" className="flex-1 overflow-y-auto px-4 py-5">
          <ul className="space-y-1.5">
            {DASHBOARD_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[44px] items-center gap-3 rounded-xl border px-3.5 py-2.5 text-sm font-semibold transition-all",
                      active
                        ? "border-neon/60 bg-neon/15 text-foreground shadow-neon"
                        : "border-transparent text-muted-foreground hover:border-glass-border hover:bg-white/5 hover:text-foreground",
                    )}
                  >
                    <Icon className={cn("h-4 w-4 shrink-0", active ? "text-electric" : "text-muted-foreground")} />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="border-t border-glass-border p-4">
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl border border-glass-border bg-white/5 px-3.5 py-2.5 text-left text-sm font-semibold text-foreground transition-colors hover:border-destructive/60 hover:bg-destructive/15 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 shrink-0 text-electric" />
            <span>{signingOut ? "Logging out…" : "Log Out"}</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Top Bar */}
        <header className="glass-strong sticky top-0 z-40 flex h-14 items-center justify-between gap-2 px-3 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-glass-border bg-white/5 text-foreground transition-colors hover:border-neon/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-electric">Free City</p>
              <p className="truncate text-sm font-bold text-foreground">{currentNav.label}</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <NotificationsPopover userId={user.uid} />
            <Link
              to="/dashboard/profile"
              aria-label="My Profile"
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full"
            >
              {user.photoURL ? (
                <img
                  src={user.photoURL}
                  alt={`${displayName} avatar`}
                  referrerPolicy="no-referrer"
                  className="h-9 w-9 rounded-full border border-glass-border object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-neon font-display text-sm font-black text-primary-foreground">
                  {userInitials(user)}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Desktop Top Bar: Compact Account Controls & Notifications */}
        <header className="glass-strong sticky top-0 z-30 hidden h-16 items-center justify-between gap-6 border-b border-glass-border px-8 lg:flex">
          <div className="flex min-w-0 items-center gap-2 text-sm">
            <span className="font-semibold uppercase tracking-[0.2em] text-muted-foreground">Dashboard</span>
            <span aria-hidden="true" className="text-muted-foreground">
              /
            </span>
            <span className="truncate font-semibold text-foreground">{currentNav.label}</span>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <NotificationsPopover userId={user.uid} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-full border border-glass-border bg-white/5 py-1 pl-1.5 pr-3 text-left transition-colors hover:border-neon/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {user.photoURL ? (
                    <img
                      src={user.photoURL}
                      alt={`${displayName} avatar`}
                      referrerPolicy="no-referrer"
                      className="h-8 w-8 rounded-full border border-glass-border object-cover"
                    />
                  ) : (
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-neon font-display text-xs font-black text-primary-foreground">
                      {userInitials(user)}
                    </span>
                  )}
                  <span className="max-w-[160px] truncate text-sm font-semibold text-foreground">{displayName}</span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="glass-strong w-60 rounded-2xl border border-glass-border p-1.5 text-foreground"
              >
                <DropdownMenuLabel className="px-2.5 py-2">
                  <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                  {user.email && <p className="truncate text-xs font-normal text-muted-foreground">{user.email}</p>}
                </DropdownMenuLabel>
                <DropdownMenuSeparator className="bg-glass-border" />
                <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-2.5 py-2">
                  <Link to="/dashboard/profile">
                    <UserRound className="h-4 w-4 text-electric" /> My Profile
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-2.5 py-2">
                  <Link to="/dashboard/settings">
                    <Settings className="h-4 w-4 text-electric" /> Settings
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild className="cursor-pointer rounded-xl px-2.5 py-2">
                  <Link to="/">
                    <ExternalLink className="h-4 w-4 text-electric" /> Public Website
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator className="bg-glass-border" />
                <DropdownMenuItem
                  onClick={handleLogout}
                  disabled={signingOut}
                  className="cursor-pointer rounded-xl px-2.5 py-2 text-destructive focus:text-destructive"
                >
                  <LogOut className="h-4 w-4" /> {signingOut ? "Logging out…" : "Log Out"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        {/* Spacious Main Dashboard Viewport */}
        <div className="mx-auto w-full max-w-5xl flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-10">{children}</div>
      </div>
    </div>
  );
}
