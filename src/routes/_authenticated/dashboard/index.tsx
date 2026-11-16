import { createFileRoute, Link } from "@tanstack/react-router";
import { CalendarDays, Crown, FileText, Gamepad2, LifeBuoy, Mail, ScrollText, UserRound } from "lucide-react";
import { DiscordPanel } from "@/components/site/DiscordPanel";
import { Button } from "@/components/ui/button";
import { profileInitials, useMemberProfile } from "@/hooks/use-member-profile";
import { formatFirestoreDate } from "@/lib/firebase";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  head: () => ({
    meta: [
      { title: "Member Dashboard — Free City Organization" },
      { name: "description", content: "Your personal Free City Organization member dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardHome,
});

const QUICK_LINKS = [
  {
    to: "/dashboard/profile" as const,
    title: "My Profile",
    description: "Inspect your Google identity details and synced member account.",
    icon: UserRound,
  },
  {
    to: "/dashboard/applications" as const,
    title: "Applications",
    description: "Submit a character concept and track your application status.",
    icon: FileText,
  },
  {
    to: "/dashboard/rules" as const,
    title: "Server Rules",
    description: "Check rulebook updates before stepping into Free City.",
    icon: ScrollText,
  },
  {
    to: "/dashboard/vip" as const,
    title: "VIP Membership",
    description: "Review your VIP verification status and supporter access.",
    icon: Crown,
  },
  {
    to: "/dashboard/game" as const,
    title: "Game Website & Installation",
    description: "Find official installation guidance and connection notices.",
    icon: Gamepad2,
  },
  {
    to: "/dashboard/events" as const,
    title: "Events",
    description: "Browse scheduled Free City community gatherings and updates.",
    icon: CalendarDays,
  },
  {
    to: "/dashboard/support" as const,
    title: "Support",
    description: "Reach Free City staff and community help via Discord.",
    icon: LifeBuoy,
  },
];

function DashboardHome() {
  const { user } = Route.useRouteContext();
  const profileQuery = useMemberProfile(user);

  const profile = profileQuery.data;
  const name = profile?.fullName || profile?.email || user.displayName || user.email || "Member";

  return (
    <section className="space-y-8 pb-10">
      <div>
        <p className="animate-fade-up text-xs font-bold uppercase tracking-[0.4em] text-electric">Member dashboard</p>
      </div>

      {profileQuery.isPending ? (
        <div className="glass h-56 animate-pulse rounded-3xl" aria-label="Loading your profile" />
      ) : profileQuery.isError ? (
        <div className="glass rounded-3xl p-6 md:p-8">
          <p className="text-muted-foreground">We couldn't load your profile right now.</p>
          <Button variant="glass" size="xl" className="mt-6" onClick={() => profileQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : !profile ? (
        <div className="glass rounded-3xl p-6 md:p-8">
          <p className="text-muted-foreground">Your member profile isn't available yet. Please sign out and sign in again.</p>
        </div>
      ) : (
        <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {profile.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={`${name}'s profile picture`}
                referrerPolicy="no-referrer"
                width={88}
                height={88}
                className="h-20 w-20 rounded-full border border-glass-border object-cover shadow-neon sm:h-24 sm:w-24"
              />
            ) : (
              <span className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-neon font-display text-3xl font-black text-primary-foreground sm:h-24 sm:w-24">
                {profileInitials(name)}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Welcome back,</p>
              <h1 className="hero-title mt-1 break-words font-display text-4xl font-black uppercase leading-[0.92] md:text-5xl">
                {name}
              </h1>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-glass-border p-5">
              <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <Mail className="h-4 w-4 text-electric" /> Google Account Email
              </dt>
              <dd className="mt-2 break-all text-foreground">{profile.email || "—"}</dd>
            </div>
            <div className="rounded-2xl border border-glass-border p-5">
              <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-electric" /> Member since
              </dt>
              <dd className="mt-2 text-foreground">{formatFirestoreDate(profile.createdAt)}</dd>
            </div>
          </dl>
        </div>
      )}

      <DiscordPanel userId={user.uid} />

      <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
        <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">Dashboard Sections</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Jump straight to your applications, server rules, events, and account tools.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {QUICK_LINKS.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className="group flex min-h-[88px] flex-col justify-between rounded-2xl border border-glass-border p-5 transition-all hover:border-neon/60 hover:bg-white/5"
              >
                <div className="flex items-center gap-2.5">
                  <Icon className="h-4 w-4 shrink-0 text-electric" />
                  <h3 className="font-display text-lg font-extrabold uppercase tracking-wide text-foreground group-hover:text-electric">
                    {item.title}
                  </h3>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{item.description}</p>
              </Link>
            );
          })}
        </div>
      </div>
    </section>
  );
}
