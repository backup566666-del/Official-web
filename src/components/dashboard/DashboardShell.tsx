import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { signOut, type User } from "firebase/auth";
import { Bell, ChevronDown, ExternalLink, LogOut, Menu, Settings, UserRound } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { DASHBOARD_NAV_ITEMS, type DashboardNavItem } from "./nav-items";
import { DiscordButton } from "@/components/site/DiscordButton";
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
import {
  auth,
  fetchDiscordConnection,
  fetchMemberApplications,
  fetchPublishedEvents,
  formatFirestoreDate,
} from "@/lib/firebase";
import { cn } from "@/lib/utils";

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

function SidebarBrandLogo() {
  const [logoFailed, setLogoFailed] = useState(false);

  return (
    <Link
      to="/"
      className="group flex items-center gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {!logoFailed && (
        <img
          src="/favicon.ico"
          alt="Free City logo"
          width={36}
          height={36}
          onError={() => setLogoFailed(true)}
          className="h-9 w-9 shrink-0 rounded-xl border border-neon/50 object-cover shadow-neon transition-transform duration-300 group-hover:scale-105"
        />
      )}
      <div className="min-w-0">
        <span className="block truncate font-display text-2xl font-black uppercase tracking-[0.24em] text-foreground transition-colors group-hover:text-electric">
          Free City
        </span>
        <span className="block text-[10px] font-bold uppercase tracking-[0.28em] text-neon-pink">
          Member Hub
        </span>
      </div>
    </Link>
  );
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
          className="relative flex min-h-[44px] min-w-[44px] cursor-pointer items-center justify-center rounded-full border border-glass-border bg-white/5 text-foreground transition-colors hover:border-neon-pink/70 hover:text-electric focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Bell className="h-4 w-4" />
          {itemCount > 0 && <span className="sr-only">{itemCount} updates</span>}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="glass-strong w-80 rounded-2xl border border-glass-border p-4 text-foreground"
      >
        <div className="flex items-center justify-between border-b border-glass-border pb-3">
          <p className="font-display text-lg font-extrabold uppercase tracking-wide">
            Notifications
          </p>
          <span className="text-xs text-muted-foreground tabular-nums">{itemCount} updates</span>
        </div>

        <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
          {applicationsQuery.isPending || eventsQuery.isPending ? (
            <p className="py-3 text-sm text-muted-foreground">Checking updates…</p>
          ) : itemCount === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">
              You have no notifications yet. Application status updates and published events will
              appear here.
            </p>
          ) : (
            <>
              {applications.slice(0, 3).map((app) => (
                <Link
                  key={app.id}
                  to="/dashboard/applications"
                  className="block rounded-xl border border-glass-border px-3 py-2.5 text-sm transition-colors hover:border-neon-pink/60"
                >
                  <p className="font-semibold text-foreground">{app.characterName}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Application status:{" "}
                    <span className="uppercase text-electric">{app.status}</span> ·{" "}
                    {formatFirestoreDate(app.createdAt)}
                  </p>
                </Link>
              ))}
              {events.slice(0, 3).map((ev) => (
                <Link
                  key={ev.id}
                  to="/dashboard/events"
                  className="block rounded-xl border border-glass-border px-3 py-2.5 text-sm transition-colors hover:border-neon-pink/60"
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

  const connectionQuery = useQuery({
    queryKey: ["discord-connection", user.uid],
    queryFn: () => fetchDiscordConnection(user.uid),
  });

  // Always close mobile navigation drawer whenever the route changes.
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  const currentNav =
    DASHBOARD_NAV_ITEMS.find((item) => isNavItemActive(pathname, item.to)) ??
    DASHBOARD_NAV_ITEMS[0]!;

  const displayName = user.displayName || user.email || "Member";
  const shortName = user.displayName?.trim().split(/\s+/)[0] || displayName;
  const connection = connectionQuery.data ?? null;

  const accountStatusText = connectionQuery.isPending
    ? "Checking account status…"
    : connection
      ? `Google Signed In · Discord Linked (@${connection.username})`
      : "Google Signed In · Discord Not Connected";

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
          className="glass-strong flex h-full w-[85vw] max-w-xs flex-col overflow-hidden border-r border-neon/35 p-0 text-foreground"
        >
          <div className="shrink-0 border-b border-glass-border px-5 py-4 pr-12">
            <SheetTitle asChild>
              <div>
                <SidebarBrandLogo />
              </div>
            </SheetTitle>
            <SheetDescription className="sr-only">
              Free City Member Dashboard Navigation
            </SheetDescription>
          </div>

          <nav
            aria-label="Mobile dashboard navigation"
            className="min-h-0 flex-1 overflow-y-auto px-3 py-4"
          >
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
                          ? "border-neon-pink/70 bg-gradient-to-r from-neon/20 to-neon-pink/15 text-foreground shadow-neon-pink"
                          : "border-transparent text-muted-foreground hover:border-neon/40 hover:bg-white/5 hover:text-foreground",
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-4 w-4 shrink-0",
                          active ? "text-neon-pink" : "text-muted-foreground",
                        )}
                      />
                      <span className="truncate">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>

          <div className="shrink-0 space-y-2 border-t border-glass-border p-3">
            <DiscordButton size="lg" className="w-full rounded-xl text-xs">
              Join Free City Discord
            </DiscordButton>
            <button
              type="button"
              onClick={handleLogout}
              disabled={signingOut}
              className="flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-xl border border-glass-border bg-white/5 px-3.5 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:border-destructive/60 hover:bg-destructive/15 disabled:opacity-50"
            >
              <LogOut className="h-4 w-4 shrink-0 text-electric" />
              <span>{signingOut ? "Logging out…" : "Log Out"}</span>
            </button>
          </div>
        </SheetContent>
      </Sheet>

      {/* Desktop Left-Hand Navigation Sidebar */}
      <aside className="glass-strong hidden lg:sticky lg:top-0 lg:flex lg:h-screen lg:w-72 lg:shrink-0 lg:flex-col lg:border-r lg:border-neon/30">
        <div className="border-b border-glass-border px-6 py-5">
          <SidebarBrandLogo />
        </div>

        <nav aria-label="Dashboard navigation" className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          <ul className="space-y-1">
            {DASHBOARD_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item.to);
              return (
                <li key={item.to}>
                  <Link
                    to={item.to}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex min-h-[42px] items-center gap-3 rounded-xl border px-3.5 py-2 text-sm font-semibold transition-all",
                      active
                        ? "border-neon-pink/70 bg-gradient-to-r from-neon/20 to-neon-pink/15 text-foreground shadow-neon-pink"
                        : "border-transparent text-muted-foreground hover:border-neon/40 hover:bg-white/5 hover:text-foreground",
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 shrink-0",
                        active ? "text-neon-pink" : "text-muted-foreground",
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="space-y-2.5 border-t border-glass-border p-4">
          <DiscordButton size="lg" className="w-full rounded-xl text-xs">
            Join Free City Discord
          </DiscordButton>
          <button
            type="button"
            onClick={handleLogout}
            disabled={signingOut}
            className="flex min-h-[42px] w-full cursor-pointer items-center gap-3 rounded-xl border border-glass-border bg-white/5 px-3.5 py-2 text-left text-sm font-semibold text-foreground transition-colors hover:border-destructive/60 hover:bg-destructive/15 disabled:opacity-50"
          >
            <LogOut className="h-4 w-4 shrink-0 text-electric" />
            <span>{signingOut ? "Logging out…" : "Log Out"}</span>
          </button>
        </div>
      </aside>

      {/* Main Column */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Mobile Top Bar */}
        <header className="glass-strong sticky top-0 z-40 flex h-14 items-center justify-between gap-2 border-b border-neon/25 px-3 lg:hidden">
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              onClick={() => setDrawerOpen(true)}
              className="flex min-h-[44px] min-w-[44px] shrink-0 cursor-pointer items-center justify-center rounded-xl border border-glass-border bg-white/5 text-foreground transition-colors hover:border-neon-pink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="min-w-0">
              <p className="truncate text-xs font-bold text-foreground">Welcome, {shortName}</p>
              <p className="truncate text-[11px] text-muted-foreground">
                {currentNav.label} · {connection ? "Discord Linked" : "Google Signed In"}
              </p>
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
                  className="h-9 w-9 rounded-full border border-neon-pink/50 object-cover"
                />
              ) : (
                <span className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-neon font-display text-sm font-black text-primary-foreground">
                  {userInitials(user)}
                </span>
              )}
            </Link>
          </div>
        </header>

        {/* Desktop Top Bar: Welcome Message, Account Status, Notifications & Account Dropdown */}
        <header className="glass-strong sticky top-0 z-30 hidden h-16 items-center justify-between gap-6 border-b border-neon/25 px-8 lg:flex">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              Welcome back, <span className="text-gradient-neon">{displayName}</span>
            </p>
            <p className="truncate text-xs text-muted-foreground">
              {currentNav.label} · {accountStatusText}
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-3">
            <NotificationsPopover userId={user.uid} />

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="flex min-h-[44px] cursor-pointer items-center gap-2.5 rounded-full border border-neon/40 bg-white/5 py-1 pl-1.5 pr-3 text-left transition-colors hover:border-neon-pink/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                  <span className="max-w-[160px] truncate text-sm font-semibold text-foreground">
                    {displayName}
                  </span>
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="end"
                className="glass-strong w-64 rounded-2xl border border-glass-border p-1.5 text-foreground"
              >
                <DropdownMenuLabel className="px-2.5 py-2">
                  <p className="truncate text-sm font-semibold text-foreground">{displayName}</p>
                  {user.email && (
                    <p className="truncate text-xs font-normal text-muted-foreground">
                      {user.email}
                    </p>
                  )}
                  <p className="mt-1 truncate text-[11px] font-medium text-electric">
                    {connection ? `Discord: @${connection.username}` : "Discord: Not connected"}
                  </p>
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
        <div className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 md:px-8 md:py-8">
          {children}
        </div>
      </div>
    </div>
  );
}
