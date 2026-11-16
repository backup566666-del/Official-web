import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Activity,
  ArrowUpRight,
  Banknote,
  CalendarDays,
  Coins,
  Crown,
  FileText,
  Gamepad2,
  Mail,
  ScrollText,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { DiscordButton } from "@/components/site/DiscordButton";
import { DiscordIcon } from "@/components/site/DiscordIcon";
import { DiscordPanel } from "@/components/site/DiscordPanel";
import { Button } from "@/components/ui/button";
import { profileInitials, useMemberProfile } from "@/hooks/use-member-profile";
import {
  fetchDiscordConnection,
  fetchMemberApplications,
  fetchPublishedEvents,
  formatFirestoreDate,
} from "@/lib/firebase";
import { DISCORD_INVITE_URL } from "@/lib/site-links";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({
    meta: [
      { title: "Member Dashboard — Free City Organization" },
      {
        name: "description",
        content: "Your personal Free City Organization member home dashboard.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardHome,
});

function toSortMillis(value: unknown): number {
  if (!value) return 0;
  if (
    typeof value === "object" &&
    value !== null &&
    "toMillis" in value &&
    typeof (value as { toMillis: unknown }).toMillis === "function"
  ) {
    return (value as { toMillis: () => number }).toMillis();
  }
  if (typeof value === "string") {
    const parsed = Date.parse(value);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

type ActivityEntry = {
  id: string;
  title: string;
  detail: string;
  dateLabel: string;
  sortMs: number;
};

function DashboardHome() {
  const { user } = Route.useRouteContext();
  const profileQuery = useMemberProfile(user);

  const connectionQuery = useQuery({
    queryKey: ["discord-connection", user.uid],
    queryFn: () => fetchDiscordConnection(user.uid),
  });

  const applicationsQuery = useQuery({
    queryKey: ["applications", user.uid],
    queryFn: () => fetchMemberApplications(user.uid),
  });

  const eventsQuery = useQuery({
    queryKey: ["published-events"],
    queryFn: fetchPublishedEvents,
  });

  const profile = profileQuery.data;
  const connection = connectionQuery.data ?? null;
  const applications = applicationsQuery.data ?? [];
  const events = eventsQuery.data ?? [];

  const displayName =
    profile?.fullName || user.displayName || profile?.email || user.email || "Member";

  const hasNumericXp = typeof connection?.xp === "number";
  const hasNumericLevel = typeof connection?.level === "number";
  const hasRealProgression = hasNumericXp || hasNumericLevel;
  const hasApplicationsOrEvents = applications.length > 0 || events.length > 0;

  const googleStatusValue = user.emailVerified ? "Connected & Verified" : "Connected";
  const googleDetail = profile?.email || user.email || "Signed in via Google";

  const discordStatusValue = connectionQuery.isPending
    ? "Checking…"
    : connection
      ? `Connected (${connection.globalName ?? connection.username})`
      : "Not Connected";
  const discordDetail = connectionQuery.isPending
    ? "Looking up Discord link"
    : connection
      ? connection.guildStatus === "member"
        ? "Verified member of the Free City Discord server"
        : connection.guildStatus === "not_member"
          ? "Linked, not currently in the Free City Discord server"
          : "Linked — server membership check pending"
      : "Connect your Discord account below to sync roles and server status";

  const membershipStatusValue = connectionQuery.isPending
    ? "Checking…"
    : connection?.guildStatus === "member"
      ? connection.guildPending
        ? "Joined · Rules Screening Pending"
        : "Active Free City Member"
      : "Website Member";
  const membershipDetail =
    profile?.createdAt !== undefined
      ? `Member since ${formatFirestoreDate(profile.createdAt)}`
      : "Signed in to Free City Organization";

  const vipStatusValue = connectionQuery.isPending
    ? "Checking…"
    : !connection
      ? "Discord Not Connected"
      : typeof connection.premiumActive === "boolean"
        ? connection.premiumActive
          ? connection.premiumTier
            ? `Active · ${connection.premiumTier}`
            : "Active"
          : "Standard Access"
        : connection.vipStatus || "Not synchronized yet";
  const vipDetail = !connection
    ? "Connect Discord to check synced VIP & AI status"
    : connection.premiumExpiresAt
      ? `Expires ${formatFirestoreDate(connection.premiumExpiresAt)}`
      : typeof connection.aiAccessEnabled === "boolean"
        ? connection.aiAccessEnabled
          ? `AI Access: ${connection.aiAccessTier || "Enabled"}`
          : "AI Access: Not enabled"
        : "Synced via Free City Railway bot when configured";

  // Build Recent Activity strictly from real persisted timestamps
  const activityEntries: ActivityEntry[] = [];

  if (profile?.createdAt) {
    activityEntries.push({
      id: "profile-created",
      title: "Free City account registered",
      detail: profile.email ? `Signed in with ${profile.email}` : "Google member profile created",
      dateLabel: formatFirestoreDate(profile.createdAt),
      sortMs: toSortMillis(profile.createdAt),
    });
  }

  if (connection?.connectedAt) {
    activityEntries.push({
      id: "discord-connected",
      title: "Discord account connected",
      detail: `@${connection.username}`,
      dateLabel: formatFirestoreDate(connection.connectedAt),
      sortMs: toSortMillis(connection.connectedAt),
    });
  }

  if (connection?.botSyncedAt && connection.botSyncStatus === "synced") {
    activityEntries.push({
      id: "bot-synced",
      title: "Free City membership data synchronized",
      detail:
        connection.roles && connection.roles.length > 0
          ? `${connection.roles.length} server role(s) synced`
          : "Latest bot record synced",
      dateLabel: formatFirestoreDate(connection.botSyncedAt),
      sortMs: toSortMillis(connection.botSyncedAt),
    });
  }

  for (const app of applications.slice(0, 3)) {
    activityEntries.push({
      id: `app-${app.id}`,
      title: `Character application · ${app.characterName}`,
      detail: `Status: ${app.status} · Discord: ${app.discordHandle}`,
      dateLabel: formatFirestoreDate(app.createdAt),
      sortMs: toSortMillis(app.createdAt),
    });
  }

  activityEntries.sort((a, b) => b.sortMs - a.sortMs);

  return (
    <section className="space-y-8 pb-10">
      {/* 1. Welcome to Free City Hero Banner Card */}
      {profileQuery.isPending ? (
        <div
          className="glass-neon h-48 animate-pulse rounded-3xl"
          aria-label="Loading your dashboard"
        />
      ) : profileQuery.isError ? (
        <div className="glass-neon rounded-3xl p-6 md:p-8">
          <p className="text-muted-foreground">
            We couldn&apos;t load your member dashboard right now.
          </p>
          <Button variant="glass" size="xl" className="mt-6" onClick={() => profileQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="animate-fade-up glass-neon relative overflow-hidden rounded-3xl p-6 md:p-8">
          <div
            aria-hidden
            className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-neon-pink/15 blur-3xl"
          />
          <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-center">
            <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
              {profile?.avatarUrl || user.photoURL ? (
                <img
                  src={profile?.avatarUrl || user.photoURL || ""}
                  alt={`${displayName}'s profile picture`}
                  referrerPolicy="no-referrer"
                  width={80}
                  height={80}
                  className="h-20 w-20 shrink-0 rounded-2xl border border-neon-pink/60 object-cover shadow-neon-pink"
                />
              ) : (
                <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-gradient-neon font-display text-3xl font-black text-primary-foreground shadow-neon">
                  {profileInitials(displayName)}
                </span>
              )}
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.38em] text-neon-pink">
                  Welcome to Free City
                </p>
                <h1 className="hero-title mt-1.5 text-balance break-words font-display text-4xl font-black uppercase leading-[0.92] md:text-5xl">
                  {displayName}
                </h1>
                <p className="mt-2.5 text-sm text-muted-foreground">
                  {user.email ?? "Signed in"} ·{" "}
                  {profile?.createdAt
                    ? `Member since ${formatFirestoreDate(profile.createdAt)}`
                    : "Active Member Session"}
                </p>
              </div>
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:shrink-0">
              <Button
                asChild
                variant="glass"
                size="xl"
                className="w-full whitespace-nowrap sm:w-auto"
              >
                <Link to="/dashboard/profile">
                  <UserRound className="h-4 w-4" /> My Profile
                </Link>
              </Button>
              <Button
                asChild
                variant="glass"
                size="xl"
                className="w-full whitespace-nowrap sm:w-auto"
              >
                <Link to="/dashboard/rules">
                  <ScrollText className="h-4 w-4" /> Server Rules
                </Link>
              </Button>
              <DiscordButton className="w-full whitespace-nowrap sm:w-auto">
                Join Free City Discord
              </DiscordButton>
            </div>
          </div>
        </div>
      )}

      {/* 2. Core Account & Membership Overview Cards */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="glass-neon rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-neon-pink/70 hover:shadow-neon-pink">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Discord Status
            </span>
            <DiscordIcon className="h-5 w-5 shrink-0 text-electric" />
          </div>
          <p className="mt-3 text-lg font-bold text-foreground">{discordStatusValue}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{discordDetail}</p>
        </article>

        <article className="glass-neon rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-neon-pink/70 hover:shadow-neon-pink">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Google Account
            </span>
            <Mail className="h-5 w-5 shrink-0 text-electric" />
          </div>
          <p className="mt-3 text-lg font-bold text-foreground">{googleStatusValue}</p>
          <p className="mt-1.5 break-all text-xs leading-relaxed text-muted-foreground">
            {googleDetail}
          </p>
        </article>

        <article className="glass-neon rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-neon-pink/70 hover:shadow-neon-pink">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Free City Membership
            </span>
            <ShieldCheck className="h-5 w-5 shrink-0 text-neon-pink" />
          </div>
          <p className="mt-3 text-lg font-bold text-foreground">{membershipStatusValue}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{membershipDetail}</p>
        </article>

        <article className="glass-neon rounded-2xl p-5 transition-all duration-300 hover:-translate-y-0.5 hover:border-neon-pink/70 hover:shadow-neon-pink">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              VIP Membership
            </span>
            <Crown className="h-5 w-5 shrink-0 text-neon-pink" />
          </div>
          <p className="mt-3 text-lg font-bold text-foreground">{vipStatusValue}</p>
          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{vipDetail}</p>
        </article>
      </div>

      {/* 3. Real XP / Level & Applications / Events Summaries (Rendered ONLY when real data exists) */}
      {(hasRealProgression || hasApplicationsOrEvents) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {hasRealProgression && (
            <div className="glass-neon rounded-3xl p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2.5 font-display text-2xl font-extrabold uppercase tracking-wide text-foreground">
                  <Sparkles className="h-5 w-5 text-neon-pink" /> Level &amp; XP Progress
                </h2>
                <span className="text-xs text-muted-foreground">Synced from Free City Bot</span>
              </div>
              <dl className="mt-5 grid gap-3 sm:grid-cols-3">
                {hasNumericLevel && (
                  <div className="rounded-2xl border border-glass-border p-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      Level
                    </dt>
                    <dd className="mt-1 font-display text-3xl font-black text-foreground tabular-nums">
                      {connection!.level}
                    </dd>
                  </div>
                )}
                {hasNumericXp && (
                  <div className="rounded-2xl border border-glass-border p-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      XP
                    </dt>
                    <dd className="mt-1 font-display text-3xl font-black text-foreground tabular-nums">
                      {connection!.xp}
                    </dd>
                  </div>
                )}
                {typeof connection?.messageCount === "number" && (
                  <div className="rounded-2xl border border-glass-border p-4">
                    <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      Messages
                    </dt>
                    <dd className="mt-1 font-display text-3xl font-black text-foreground tabular-nums">
                      {connection.messageCount}
                    </dd>
                  </div>
                )}
              </dl>
            </div>
          )}

          {hasApplicationsOrEvents && (
            <div className="glass-neon rounded-3xl p-6">
              <h2 className="flex items-center gap-2.5 font-display text-2xl font-extrabold uppercase tracking-wide text-foreground">
                <CalendarDays className="h-5 w-5 text-electric" /> Applications &amp; Events
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {applications.length > 0 && (
                  <Link
                    to="/dashboard/applications"
                    className="group rounded-2xl border border-glass-border p-4 transition-all hover:border-neon-pink/60 hover:bg-white/5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        Applications
                      </span>
                      <FileText className="h-4 w-4 text-electric" />
                    </div>
                    <p className="mt-2 font-display text-3xl font-black text-foreground tabular-nums">
                      {applications.length}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Latest: {applications[0]!.characterName} ({applications[0]!.status})
                    </p>
                  </Link>
                )}

                {events.length > 0 && (
                  <Link
                    to="/dashboard/events"
                    className="group rounded-2xl border border-glass-border p-4 transition-all hover:border-neon-pink/60 hover:bg-white/5"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        Published Events
                      </span>
                      <CalendarDays className="h-4 w-4 text-neon-pink" />
                    </div>
                    <p className="mt-2 font-display text-3xl font-black text-foreground tabular-nums">
                      {events.length}
                    </p>
                    <p className="mt-1 truncate text-xs text-muted-foreground">
                      Next: {events[0]!.title} · {events[0]!.startsAt}
                    </p>
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Prominent Quick Action Cards */}
      <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.35em] text-electric">
              Fast Access
            </p>
            <h2 className="mt-1 font-display text-2xl font-extrabold uppercase tracking-wide md:text-3xl">
              Quick Actions
            </h2>
          </div>
          <p className="text-sm text-muted-foreground">
            Jump directly to top-ups, VIP access, game setup, or Discord.
          </p>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
          <Link
            to="/dashboard/top-up"
            className="glass-neon group flex min-h-[124px] flex-col justify-between rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-neon-pink/80 hover:shadow-neon-pink"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-neon/40 bg-neon/15 text-electric">
                <Coins className="h-5 w-5" />
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-neon-pink" />
            </div>
            <div className="mt-4">
              <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-foreground">
                Game Top-up
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Check account readiness &amp; packs.
              </p>
            </div>
          </Link>

          <Link
            to="/dashboard/cash-top-up"
            className="glass-neon group flex min-h-[124px] flex-col justify-between rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-neon-pink/80 hover:shadow-neon-pink"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-neon-pink/40 bg-neon-pink/15 text-neon-pink">
                <Banknote className="h-5 w-5" />
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-neon-pink" />
            </div>
            <div className="mt-4">
              <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-foreground">
                Cash Top-up
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Prepare citizen wallet top-ups.
              </p>
            </div>
          </Link>

          <Link
            to="/dashboard/vip"
            className="glass-neon group flex min-h-[124px] flex-col justify-between rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-neon-pink/80 hover:shadow-neon-pink"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-neon/40 bg-neon/15 text-neon-pink">
                <Crown className="h-5 w-5" />
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-neon-pink" />
            </div>
            <div className="mt-4">
              <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-foreground">
                VIP Membership
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Synced Premium &amp; AI access.
              </p>
            </div>
          </Link>

          <Link
            to="/dashboard/game"
            className="glass-neon group flex min-h-[124px] flex-col justify-between rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-neon-pink/80 hover:shadow-neon-pink"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-electric/40 bg-electric/15 text-electric">
                <Gamepad2 className="h-5 w-5" />
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-neon-pink" />
            </div>
            <div className="mt-4">
              <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-foreground">
                Game Installation
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Game website &amp; launch guide.
              </p>
            </div>
          </Link>

          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="glass-neon group flex min-h-[124px] flex-col justify-between rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 hover:border-neon-pink/80 hover:shadow-neon-pink sm:col-span-2 lg:col-span-2 xl:col-span-1"
          >
            <div className="flex items-center justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-electric/40 bg-electric/15 text-electric">
                <DiscordIcon className="h-5 w-5" />
              </span>
              <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-neon-pink" />
            </div>
            <div className="mt-4">
              <h3 className="font-display text-xl font-extrabold uppercase tracking-wide text-foreground">
                Join Discord
              </h3>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                Enter official Free City server.
              </p>
            </div>
          </a>
        </div>
      </div>

      {/* 5. Recent Member Activity (Strictly Real Persisted Data) */}
      <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold uppercase tracking-wide">
            <Activity className="h-6 w-6 text-neon-pink" /> Recent Activity
          </h2>
          <span className="text-xs text-muted-foreground">
            Recorded account &amp; membership events
          </span>
        </div>

        {profileQuery.isPending || connectionQuery.isPending || applicationsQuery.isPending ? (
          <div
            className="mt-5 h-24 animate-pulse rounded-2xl border border-glass-border"
            aria-label="Loading recent activity"
          />
        ) : activityEntries.length === 0 ? (
          <p className="mt-4 text-sm text-muted-foreground">
            No activity recorded yet. Account registration, Discord linking, and application updates
            will appear here automatically.
          </p>
        ) : (
          <ul className="mt-5 divide-y divide-glass-border rounded-2xl border border-glass-border">
            {activityEntries.map((item) => (
              <li
                key={item.id}
                className="flex flex-col justify-between gap-2 p-4 sm:flex-row sm:items-center"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-foreground">{item.title}</p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">{item.detail}</p>
                </div>
                <span className="shrink-0 text-xs font-medium text-electric tabular-nums">
                  {item.dateLabel}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 6. Live Discord Connection & Sync Controls */}
      <DiscordPanel userId={user.uid} />
    </section>
  );
}
