import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  Banknote,
  CheckCircle2,
  Clock,
  Coins,
  Crown,
  LifeBuoy,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { DiscordButton } from "@/components/site/DiscordButton";
import { Button } from "@/components/ui/button";
import { syncDiscordConnection } from "@/lib/discord-client";
import { auth, fetchDiscordConnection, formatFirestoreDate } from "@/lib/firebase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/cash-top-up")({
  head: () => ({
    meta: [
      { title: "Cash Top-up — Member Dashboard — Free City Organization" },
      {
        name: "description",
        content: "Prepare your Free City member account for official Cash Top-ups.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CashTopUpPage,
});

type CashTab = "overview" | "readiness" | "safety";

function CashTopUpPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<CashTab>("overview");
  const [syncing, setSyncing] = useState(false);

  const connectionQuery = useQuery({
    queryKey: ["discord-connection", user.uid],
    queryFn: () => fetchDiscordConnection(user.uid),
  });

  async function handleRefreshStatus() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setSyncing(true);
    try {
      const result = await syncDiscordConnection(currentUser);
      await queryClient.invalidateQueries({ queryKey: ["discord-connection", user.uid] });
      if (result.botSyncStatus === "synced") {
        toast.success("Account and Free City membership status refreshed.");
      } else {
        toast.info(
          result.message ||
            "Discord status refreshed; Free City bot sync is pending configuration.",
        );
      }
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not refresh account status right now.",
      );
    } finally {
      setSyncing(false);
    }
  }

  const connection = connectionQuery.data ?? null;
  const isDiscordLinked = Boolean(connection);
  const isGuildMember = connection?.guildStatus === "member";

  return (
    <section className="space-y-8 pb-10">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-neon-pink">
          Supporter Treasury
        </p>
        <h1 className="hero-title mt-2 text-balance font-display text-4xl font-black uppercase leading-[0.95] md:text-5xl">
          Cash Top-up
        </h1>
      </div>

      <div className="animate-fade-up glass-neon rounded-3xl p-6 md:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold uppercase tracking-wide text-foreground">
            <Banknote className="h-6 w-6 text-neon-pink" /> In-Game Cash Top-up Readiness
          </h2>
          <span className="text-xs font-semibold text-muted-foreground">
            {isDiscordLinked ? `Linked @${connection?.username}` : "Discord not linked"}
          </span>
        </div>

        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Cash Top-up is kept separate from Game Top-up so your character wallet and store perks
          remain clearly organized. Live currency amounts, pricing, and checkout are not active on
          the website yet and require official backend payment-provider and server ledger
          integration.
        </p>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-2xl border border-glass-border p-4">
            <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Google Account
            </dt>
            <dd className="mt-1.5 truncate text-sm font-semibold text-foreground">
              {user.email ?? "Signed in"}
            </dd>
          </div>
          <div className="rounded-2xl border border-glass-border p-4">
            <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Discord Identity
            </dt>
            <dd className="mt-1.5 truncate text-sm font-semibold text-foreground">
              {connectionQuery.isPending
                ? "Checking…"
                : connection
                  ? `${connection.globalName ?? connection.username}`
                  : "Not connected"}
            </dd>
          </div>
          <div className="rounded-2xl border border-glass-border p-4 sm:col-span-2 lg:col-span-1">
            <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
              Checkout Status
            </dt>
            <dd className="mt-1.5 text-sm font-semibold text-foreground">
              Awaiting backend payment integration
            </dd>
          </div>
        </dl>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          {isDiscordLinked ? (
            <Button
              type="button"
              variant="glass"
              size="xl"
              className="w-full whitespace-nowrap sm:w-auto"
              onClick={handleRefreshStatus}
              disabled={syncing}
            >
              <RefreshCw className={syncing ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {syncing ? "Refreshing…" : "Refresh Account Status"}
            </Button>
          ) : (
            <Button asChild variant="neon" size="xl" className="w-full whitespace-nowrap sm:w-auto">
              <Link to="/dashboard">Connect Discord on Home</Link>
            </Button>
          )}
          <DiscordButton className="w-full whitespace-nowrap sm:w-auto">
            Join Free City Discord
          </DiscordButton>
        </div>
      </div>

      <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
        <div
          role="tablist"
          aria-label="Cash top-up information sections"
          className="inline-flex w-full flex-wrap gap-1.5 rounded-2xl border border-glass-border bg-background/50 p-1.5 sm:w-auto"
        >
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "overview"}
            onClick={() => setActiveTab("overview")}
            className={cn(
              "min-h-[42px] flex-1 cursor-pointer rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] whitespace-nowrap transition-colors sm:flex-none",
              activeTab === "overview"
                ? "bg-neon/25 text-foreground shadow-neon-pink"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Overview
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "readiness"}
            onClick={() => setActiveTab("readiness")}
            className={cn(
              "min-h-[42px] flex-1 cursor-pointer rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] whitespace-nowrap transition-colors sm:flex-none",
              activeTab === "readiness"
                ? "bg-neon/25 text-foreground shadow-neon-pink"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Account Readiness
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === "safety"}
            onClick={() => setActiveTab("safety")}
            className={cn(
              "min-h-[42px] flex-1 cursor-pointer rounded-xl px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] whitespace-nowrap transition-colors sm:flex-none",
              activeTab === "safety"
                ? "bg-neon/25 text-foreground shadow-neon-pink"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Safety &amp; Notice
          </button>
        </div>

        {activeTab === "overview" && (
          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-glass-border p-5">
              <p className="font-display text-3xl font-black text-gradient-neon">01</p>
              <h3 className="mt-3 font-display text-lg font-extrabold uppercase tracking-wide text-foreground">
                Verified Identity
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Ensure your Google account and Discord ID are connected so future cash deliveries
                map to the right citizen.
              </p>
            </div>
            <div className="rounded-2xl border border-glass-border p-5">
              <p className="font-display text-3xl font-black text-gradient-neon">02</p>
              <h3 className="mt-3 font-display text-lg font-extrabold uppercase tracking-wide text-foreground">
                Payment Gateway Required
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                No payment provider, currency bundle, or balance ledger is active here until
                server-side billing is wired.
              </p>
            </div>
            <div className="rounded-2xl border border-glass-border p-5">
              <p className="font-display text-3xl font-black text-gradient-neon">03</p>
              <h3 className="mt-3 font-display text-lg font-extrabold uppercase tracking-wide text-foreground">
                Official Delivery Only
              </h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                Any official supporter updates and announcements are always shared through our
                verified Discord server.
              </p>
            </div>
          </div>
        )}

        {activeTab === "readiness" && (
          <ul className="mt-6 space-y-3">
            <li className="flex flex-col justify-between gap-3 rounded-2xl border border-glass-border p-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-electric" />
                <div>
                  <p className="font-semibold text-foreground">Google Authentication</p>
                  <p className="text-xs text-muted-foreground">
                    Signed in as {user.email ?? "verified member"}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-electric">
                Ready
              </span>
            </li>

            <li className="flex flex-col justify-between gap-3 rounded-2xl border border-glass-border p-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                {isDiscordLinked ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-electric" />
                ) : (
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className="font-semibold text-foreground">Discord Account Linked</p>
                  <p className="text-xs text-muted-foreground">
                    {connection
                      ? `Connected as @${connection.username} (ID ${connection.discordUserId})`
                      : "Connect your Discord account on Dashboard Home first."}
                  </p>
                </div>
              </div>
              {isDiscordLinked ? (
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-electric">
                  Ready
                </span>
              ) : (
                <Link
                  to="/dashboard"
                  className="text-xs font-bold uppercase tracking-[0.16em] text-electric underline-offset-4 hover:underline"
                >
                  Connect Now
                </Link>
              )}
            </li>

            <li className="flex flex-col justify-between gap-3 rounded-2xl border border-glass-border p-4 sm:flex-row sm:items-center">
              <div className="flex items-start gap-3">
                {isGuildMember ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-electric" />
                ) : (
                  <Clock className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                )}
                <div>
                  <p className="font-semibold text-foreground">Free City Server Membership</p>
                  <p className="text-xs text-muted-foreground">
                    {connection?.botSyncedAt
                      ? `Last bot sync: ${formatFirestoreDate(connection.botSyncedAt)}`
                      : isGuildMember
                        ? "Verified in Free City Discord"
                        : "Join the Free City Discord server and refresh your status"}
                  </p>
                </div>
              </div>
              <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                {isGuildMember ? "Verified" : "Pending"}
              </span>
            </li>
          </ul>
        )}

        {activeTab === "safety" && (
          <div className="mt-6 space-y-3">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-neon-pink" />
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-wide text-foreground">
                Zero Unverified Transactions
              </h3>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              This page intentionally omits fake balances, synthetic prices, and unbacked checkout
              forms. Never trust unofficial payment links outside verified Free City channels.
            </p>
          </div>
        )}

        <div className="mt-8 grid gap-3 border-t border-glass-border pt-6 sm:grid-cols-3">
          <Link
            to="/dashboard/top-up"
            className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-glass-border p-4 transition-colors hover:border-neon-pink/60 hover:bg-white/5"
          >
            <Coins className="h-5 w-5 shrink-0 text-electric" />
            <div>
              <p className="font-semibold text-foreground">Game Top-up</p>
              <p className="text-xs text-muted-foreground">Account &amp; pack readiness</p>
            </div>
          </Link>
          <Link
            to="/dashboard/vip"
            className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-glass-border p-4 transition-colors hover:border-neon-pink/60 hover:bg-white/5"
          >
            <Crown className="h-5 w-5 shrink-0 text-electric" />
            <div>
              <p className="font-semibold text-foreground">VIP Membership</p>
              <p className="text-xs text-muted-foreground">Synced Premium &amp; AI status</p>
            </div>
          </Link>
          <Link
            to="/dashboard/support"
            className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-glass-border p-4 transition-colors hover:border-neon-pink/60 hover:bg-white/5"
          >
            <LifeBuoy className="h-5 w-5 shrink-0 text-electric" />
            <div>
              <p className="font-semibold text-foreground">Support</p>
              <p className="text-xs text-muted-foreground">Reach Free City staff</p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
