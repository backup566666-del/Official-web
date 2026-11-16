import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { signOut } from "firebase/auth";
import { KeyRound, LogOut, RefreshCw, ServerCog, Settings, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useMemberProfile } from "@/hooks/use-member-profile";
import { fetchIntegrationStatus } from "@/lib/discord-client";
import { auth, formatFirestoreDate, isAdminUser, syncUserProfile } from "@/lib/firebase";

export const Route = createFileRoute("/_authenticated/dashboard/settings")({
  head: () => ({
    meta: [
      { title: "Settings — Member Dashboard — Free City Organization" },
      { name: "description", content: "Account, session, and server-side integration settings for your Free City account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SettingsPage,
});

function FlagBadge({ configured, label }: { configured: boolean; label: string }) {
  return (
    <span className="flex items-center gap-2 text-sm text-foreground">
      <span
        className={`h-2 w-2 shrink-0 rounded-full ${configured ? "bg-electric" : "bg-muted-foreground"}`}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}

function SettingsPage() {
  const { user } = Route.useRouteContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const profileQuery = useMemberProfile(user);
  const isAdmin = isAdminUser(user);

  const [syncing, setSyncing] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [probingApi, setProbingApi] = useState(false);

  const integrationQuery = useQuery({
    queryKey: ["integration-status", user.uid],
    enabled: isAdmin,
    queryFn: () => fetchIntegrationStatus(user, false),
  });

  async function handleRefreshProfile() {
    setSyncing(true);
    try {
      await syncUserProfile(user);
      await queryClient.invalidateQueries({ queryKey: ["profile", user.uid] });
      toast.success("Google profile details refreshed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sync Google profile details.");
    } finally {
      setSyncing(false);
    }
  }

  async function handleProbeRailwayApi() {
    setProbingApi(true);
    try {
      const fresh = await fetchIntegrationStatus(user, true);
      queryClient.setQueryData(["integration-status", user.uid], fresh);
      if (fresh.botApiReachable) {
        toast.success(fresh.botApiMessage);
      } else {
        toast.info(fresh.botApiMessage);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not test Railway bot API connection.");
    } finally {
      setProbingApi(false);
    }
  }

  async function handleLogout() {
    setSigningOut(true);
    await queryClient.cancelQueries();
    queryClient.clear();
    await signOut(auth);
    navigate({ to: "/login", replace: true });
  }

  const profile = profileQuery.data;
  const integration = integrationQuery.data;

  return (
    <section className="space-y-8 pb-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-electric">Account &amp; Session</p>
        <h1 className="hero-title mt-2 font-display text-4xl font-black uppercase leading-[0.95] md:text-5xl">
          Settings
        </h1>
      </div>

      <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
        <div className="flex items-center gap-3">
          <Settings className="h-6 w-6 text-electric" />
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">Google Account Sync</h2>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Your Free City member profile syncs automatically from your verified Google account. If you recently updated your Google display name or avatar, you can refresh it below.
        </p>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-glass-border p-5">
            <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Sign-in Method</dt>
            <dd className="mt-2 text-foreground">Google Authentication (Firebase)</dd>
          </div>
          <div className="rounded-2xl border border-glass-border p-5">
            <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Last Profile Update</dt>
            <dd className="mt-2 text-foreground">{formatFirestoreDate(profile?.updatedAt)}</dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            type="button"
            variant="glass"
            size="xl"
            className="w-full sm:w-auto"
            onClick={handleRefreshProfile}
            disabled={syncing}
          >
            <RefreshCw className={syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
            {syncing ? "Refreshing…" : "Refresh Google profile"}
          </Button>
          <Button
            type="button"
            variant="neon"
            size="xl"
            className="w-full sm:w-auto"
            onClick={handleLogout}
            disabled={signingOut}
          >
            <LogOut className="h-4 w-4" />
            {signingOut ? "Logging out…" : "Log Out"}
          </Button>
        </div>
      </div>

      {isAdmin && (
        <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold uppercase tracking-wide">
              <ServerCog className="h-6 w-6 text-electric" /> Free City API Integration (Server-Side)
            </h2>
            <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-electric">
              <ShieldCheck className="h-4 w-4" /> Secrets Server-Only
            </span>
          </div>

          <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            Private credentials (<code className="text-foreground">FREE_CITY_BOT_API_KEY</code>,{" "}
            <code className="text-foreground">DISCORD_CLIENT_SECRET</code>) are stored exclusively in server-side
            environment variables and are never sent to browser JavaScript or Firestore.
          </p>

          {integrationQuery.isPending ? (
            <div className="mt-6 h-32 animate-pulse rounded-2xl border border-glass-border" />
          ) : integrationQuery.isError ? (
            <p className="mt-4 text-sm text-muted-foreground">Could not check server-side integration status right now.</p>
          ) : integration ? (
            <>
              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl border border-glass-border p-5">
                  <dt className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    <KeyRound className="h-4 w-4 text-electric" /> Railway Bot API
                  </dt>
                  <dd className="mt-2">
                    <FlagBadge
                      configured={integration.botApiConfigured}
                      label={
                        integration.botApiConfigured
                          ? `Configured (${integration.botApiHost ?? "HTTPS endpoint"})`
                          : "Not configured yet"
                      }
                    />
                  </dd>
                  <p className="mt-1.5 text-xs text-muted-foreground">{integration.botApiMessage}</p>
                </div>

                <div className="rounded-2xl border border-glass-border p-5">
                  <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Discord OAuth2</dt>
                  <dd className="mt-2">
                    <FlagBadge
                      configured={integration.oauthConfigured}
                      label={integration.oauthConfigured ? "Client ID & Secret configured" : "Not configured yet"}
                    />
                  </dd>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Server check: {integration.guildConfigured ? "DISCORD_GUILD_ID set" : "DISCORD_GUILD_ID not set"}
                  </p>
                </div>

                <div className="rounded-2xl border border-glass-border p-5 sm:col-span-2">
                  <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    Server Firestore Admin &amp; Proposed Contract
                  </dt>
                  <dd className="mt-2">
                    <FlagBadge
                      configured={integration.firestoreAdminConfigured}
                      label={
                        integration.firestoreAdminConfigured
                          ? "Server Firestore Admin credentials ready"
                          : "Set FIREBASE_SERVICE_ACCOUNT_JSON or run with Cloud Run ADC"
                      }
                    />
                  </dd>
                  <p className="mt-2 font-mono text-xs text-muted-foreground">
                    GET /health · GET /api/members/:discordUserId · Header: x-api-key
                  </p>
                </div>
              </dl>

              <div className="mt-6">
                <Button
                  type="button"
                  variant="glass"
                  size="xl"
                  className="w-full sm:w-auto"
                  onClick={handleProbeRailwayApi}
                  disabled={probingApi}
                >
                  <RefreshCw className={probingApi ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
                  {probingApi ? "Testing /health…" : "Test Railway Bot API Connection"}
                </Button>
              </div>
            </>
          ) : null}
        </div>
      )}
    </section>
  );
}
