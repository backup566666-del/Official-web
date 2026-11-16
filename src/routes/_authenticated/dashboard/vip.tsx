import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Crown, RefreshCw, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DiscordButton } from "@/components/site/DiscordButton";
import { Button } from "@/components/ui/button";
import { syncDiscordConnection } from "@/lib/discord-client";
import { auth, fetchDiscordConnection, formatFirestoreDate } from "@/lib/firebase";

export const Route = createFileRoute("/_authenticated/dashboard/vip")({
  head: () => ({
    meta: [
      { title: "VIP Membership — Member Dashboard — Free City Organization" },
      { name: "description", content: "VIP Membership, Premium subscription, and AI access for your Free City account." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VipPage,
});

function VipPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [syncing, setSyncing] = useState(false);

  const connectionQuery = useQuery({
    queryKey: ["discord-connection", user.uid],
    queryFn: () => fetchDiscordConnection(user.uid),
  });

  async function handleSync() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setSyncing(true);
    try {
      const result = await syncDiscordConnection(currentUser);
      await queryClient.invalidateQueries({ queryKey: ["discord-connection", user.uid] });
      if (result.botSyncStatus === "synced") {
        toast.success("Premium and AI access status synced.");
      } else {
        toast.info(result.message || "Free City bot API is not synchronized yet.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sync status right now.");
    } finally {
      setSyncing(false);
    }
  }

  const connection = connectionQuery.data ?? null;

  const premiumLabel = !connection
    ? "Not verified (Discord NOT CONNECTED)"
    : typeof connection.premiumActive === "boolean"
      ? connection.premiumActive
        ? connection.premiumTier
          ? `Active — ${connection.premiumTier}`
          : "Active"
        : "Not active"
      : connection.vipStatus || "Not synchronized yet";

  const aiLabel = !connection
    ? "Not verified (Discord NOT CONNECTED)"
    : typeof connection.aiAccessEnabled === "boolean"
      ? connection.aiAccessEnabled
        ? connection.aiAccessTier
          ? `Enabled — ${connection.aiAccessTier}`
          : "Enabled"
        : "Not enabled"
      : "Not synchronized yet";

  const levelDisplay = typeof connection?.level === "number" ? String(connection.level) : "—";
  const xpDisplay = typeof connection?.xp === "number" ? String(connection.xp) : "—";

  return (
    <section className="space-y-8 pb-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-electric">Supporter Access</p>
        <h1 className="hero-title mt-2 font-display text-4xl font-black uppercase leading-[0.95] md:text-5xl">
          VIP Membership
        </h1>
      </div>

      <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold uppercase tracking-wide">
            <Crown className="h-6 w-6 text-electric" /> Premium &amp; AI Access Status
          </h2>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
            {connection ? "Discord Connected" : "NOT CONNECTED"}
          </span>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-2xl border border-glass-border p-5">
            <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Premium Subscription</dt>
            <dd className="mt-2 text-foreground">{connectionQuery.isPending ? "Checking…" : premiumLabel}</dd>
            {connection?.premiumExpiresAt && (
              <p className="mt-1 text-xs text-muted-foreground">
                Expires {formatFirestoreDate(connection.premiumExpiresAt)}
              </p>
            )}
          </div>
          <div className="rounded-2xl border border-glass-border p-5">
            <dt className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5 text-electric" /> AI Access
            </dt>
            <dd className="mt-2 text-foreground">{connectionQuery.isPending ? "Checking…" : aiLabel}</dd>
          </div>
          <div className="rounded-2xl border border-glass-border p-5">
            <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Level</dt>
            <dd className="mt-2 text-foreground tabular-nums">{connectionQuery.isPending ? "Checking…" : levelDisplay}</dd>
          </div>
          <div className="rounded-2xl border border-glass-border p-5">
            <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">XP</dt>
            <dd className="mt-2 text-foreground tabular-nums">{connectionQuery.isPending ? "Checking…" : xpDisplay}</dd>
          </div>
        </dl>

        <p className="mt-6 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Premium subscription status, AI access, community roles, level, and XP synchronize exclusively from your verified Discord connection and the Free City Railway bot database. No placeholder tiers or unverified statuses are displayed here.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {connection ? (
            <Button
              type="button"
              variant="glass"
              size="xl"
              className="w-full sm:w-auto"
              onClick={handleSync}
              disabled={syncing}
            >
              <RefreshCw className={syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {syncing ? "Syncing…" : "Refresh from Free City API"}
            </Button>
          ) : (
            <Button asChild variant="neon" size="xl" className="w-full sm:w-auto">
              <Link to="/dashboard">Connect Discord on Home</Link>
            </Button>
          )}
          <DiscordButton className="w-full sm:w-auto">Join Free City Discord</DiscordButton>
        </div>
      </div>
    </section>
  );
}
