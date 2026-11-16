import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, Mail, ShieldCheck } from "lucide-react";
import { DiscordPanel } from "@/components/site/DiscordPanel";
import { Button } from "@/components/ui/button";
import { profileInitials, useMemberProfile } from "@/hooks/use-member-profile";
import { formatFirestoreDate } from "@/lib/firebase";

export const Route = createFileRoute("/_authenticated/dashboard/profile")({
  head: () => ({
    meta: [
      { title: "My Profile — Free City Organization" },
      { name: "description", content: "Your Google account profile and Discord link status." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ProfilePage,
});

function ProfilePage() {
  const { user } = Route.useRouteContext();
  const profileQuery = useMemberProfile(user);

  const profile = profileQuery.data;
  const name = profile?.fullName || profile?.email || user.displayName || user.email || "Member";

  return (
    <section className="space-y-8 pb-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-electric">Identity &amp; Sync</p>
        <h1 className="hero-title mt-2 font-display text-4xl font-black uppercase leading-[0.95] md:text-5xl">
          My Profile
        </h1>
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
      ) : (
        <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
          <div className="flex flex-col items-start gap-5 sm:flex-row sm:items-center">
            {profile?.avatarUrl ? (
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
              <p className="text-xs font-bold uppercase tracking-[0.25em] text-electric">Google Account</p>
              <h2 className="mt-1 break-words font-display text-3xl font-black uppercase tracking-wide text-foreground">
                {name}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {user.emailVerified ? "Verified Google account" : "Google account"}
              </p>
            </div>
          </div>

          <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="rounded-2xl border border-glass-border p-5">
              <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <Mail className="h-4 w-4 text-electric" /> Email
              </dt>
              <dd className="mt-2 break-all text-foreground">{profile?.email || user.email || "—"}</dd>
            </div>
            <div className="rounded-2xl border border-glass-border p-5">
              <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-electric" /> Member since
              </dt>
              <dd className="mt-2 text-foreground">{formatFirestoreDate(profile?.createdAt)}</dd>
            </div>
            <div className="rounded-2xl border border-glass-border p-5 sm:col-span-2 lg:col-span-1">
              <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <ShieldCheck className="h-4 w-4 text-electric" /> Member ID
              </dt>
              <dd className="mt-2 break-all font-mono text-xs text-muted-foreground">{user.uid}</dd>
            </div>
          </dl>
        </div>
      )}

      <DiscordPanel userId={user.uid} />
    </section>
  );
}
