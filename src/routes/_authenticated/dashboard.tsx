import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, LogOut, Mail } from "lucide-react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signOutGoogleSession, type GoogleAuthUser } from "@/lib/google-auth";
import { Button } from "@/components/ui/button";
import { DiscordPanel } from "@/components/site/DiscordPanel";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Member Dashboard — Free City Organization" },
      { name: "description", content: "Your personal Free City Organization member dashboard." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Dashboard,
});

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

function isGoogleAuthUser(user: unknown): user is GoogleAuthUser {
  return Boolean(user && typeof user === "object" && "provider" in user && (user as { provider?: unknown }).provider === "google");
}

function Dashboard() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [signingOut, setSigningOut] = useState(false);
  const googleUser = isGoogleAuthUser(user) ? user : null;

  const profileQuery = useQuery({
    queryKey: ["profile", user.id],
    queryFn: async () => {
      if (googleUser) {
        return {
          full_name: googleUser.full_name,
          email: googleUser.email,
          avatar_url: googleUser.avatar_url,
          account_created_at: googleUser.account_created_at,
        };
      }
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, email, avatar_url, account_created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  async function handleLogout() {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    await Promise.all([signOutGoogleSession(), supabase.auth.signOut()]);
    navigate({ to: "/login", replace: true });
  }

  const profile = profileQuery.data;
  const name = profile?.full_name || profile?.email || "Member";

  return (
    <section className="mx-auto max-w-4xl px-5 pb-24 pt-32 md:px-8 md:pt-44">
      <p className="animate-fade-up text-xs font-bold uppercase tracking-[0.4em] text-electric">Member dashboard</p>

      {profileQuery.isPending ? (
        <div className="glass mt-6 h-56 animate-pulse rounded-3xl" aria-label="Loading your profile" />
      ) : profileQuery.isError ? (
        <div className="glass mt-6 rounded-3xl p-6 md:p-10">
          <p className="text-muted-foreground">We couldn't load your profile right now.</p>
          <Button variant="glass" size="xl" className="mt-6" onClick={() => profileQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : !profile ? (
        <div className="glass mt-6 rounded-3xl p-6 md:p-10">
          <p className="text-muted-foreground">Your member profile isn't available yet. Please sign out and sign in again.</p>
        </div>
      ) : (
        <div className="animate-fade-up glass mt-6 rounded-3xl p-6 md:p-10">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center">
            {profile.avatar_url ? (
              <img
                src={profile.avatar_url}
                alt={`${name}'s profile picture`}
                referrerPolicy="no-referrer"
                width={96}
                height={96}
                className="h-24 w-24 rounded-full border border-glass-border object-cover shadow-neon"
              />
            ) : (
              <span className="flex h-24 w-24 items-center justify-center rounded-full bg-gradient-neon font-display text-3xl font-black text-primary-foreground">
                {initials(name)}
              </span>
            )}
            <div className="min-w-0">
              <p className="text-sm text-muted-foreground">Welcome back,</p>
              <h1 className="hero-title mt-1 break-words font-display text-4xl font-black uppercase leading-[0.9] md:text-6xl">
                {name}
              </h1>
            </div>
          </div>

          <dl className="mt-8 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-glass-border p-5">
              <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <Mail className="h-4 w-4 text-electric" /> Email
              </dt>
              <dd className="mt-2 break-all text-foreground">{profile.email ?? "—"}</dd>
            </div>
            <div className="rounded-2xl border border-glass-border p-5">
              <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                <CalendarDays className="h-4 w-4 text-electric" /> Member since
              </dt>
              <dd className="mt-2 text-foreground">{formatDate(profile.account_created_at)}</dd>
            </div>
          </dl>
        </div>
      )}

      <DiscordPanel userId={user.id} hasSupabaseSession={!googleUser} />

      <Button variant="glass" size="xl" className="mt-8" onClick={handleLogout} disabled={signingOut}>
        <LogOut /> {signingOut ? "Signing out…" : "Log out"}
      </Button>
    </section>
  );
}
