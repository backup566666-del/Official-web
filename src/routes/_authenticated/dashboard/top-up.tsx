import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Coins,
  Crown,
  Gamepad2,
  LifeBuoy,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import topupBanner from "@/assets/images/game_topup_banner_1794825556690.jpg";
import { DiscordButton } from "@/components/site/DiscordButton";
import { Button } from "@/components/ui/button";
import { syncDiscordConnection } from "@/lib/discord-client";
import { auth, fetchDiscordConnection, formatFirestoreDate } from "@/lib/firebase";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/top-up")({
  head: () => ({
    meta: [
      { title: "Game Top-up — Member Dashboard — Free City Organization" },
      {
        name: "description",
        content: "Prepare your Free City member account for official in-game top-ups.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GameTopUpPage,
});

type TopUpTab = "overview" | "readiness" | "safety";

function GameTopUpPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TopUpTab>("overview");
  const [syncing, setSyncing] = useState(false);
  const [bannerFailed, setBannerFailed] = useState(false);

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
        toast.success("Account and Free City supporter status refreshed.");
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

  const premiumLabel = !connection
    ? "Discord not connected"
    : typeof connection.premiumActive === "boolean"
      ? connection.premiumActive
        ? connection.premiumTier
          ? `Active · ${connection.premiumTier}`
          : "Active"
        : "Standard"
      : connection.vipStatus || "Pending bot sync";

  const aiLabel = !connection
    ? "Discord not connected"
    : typeof connection.aiAccessEnabled === "boolean"
      ? connection.aiAccessEnabled
        ? connection.aiAccessTier
          ? `Enabled · ${connection.aiAccessTier}`
          : "Enabled"
        : "Not enabled"
      : "Pending bot sync";

  return (
    <section className="space-y-8 pb-10">
      <div className="max-w-2xl">
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-electric">
          Supporter Vault
        </p>
        <h1 className="hero-title mt-2 text-balance font-display text-4xl font-black uppercase leading-[0.95] md:text-5xl">
          Game Top-up
        </h1>
      </div>

      {/* Primary Gaming Showcase & Real Account Summary */}
      <div className="animate-fade-up glass overflow-hidden rounded-3xl">
        <div className="grid items-stretch lg:grid-cols-[1.15fr_1fr]">
          <div className="flex flex-col justify-between p-6 md:p-8">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold uppercase tracking-wide text-foreground">
                  <Coins className="h-6 w-6 text-electric" /> Member Top-up Center
                </h2>
                <span className="text-xs font-semibold text-muted-foreground">
                  {isDiscordLinked ? `Linked @${connection?.username}` : "Discord not linked"}
                </span>
              </div>

              <p className="mt-4 text-sm leading-relaxed text-muted-foreground">
                This hub prepares your Free City account for official in-game supporter packs and
                balance top-ups. Live checkout packages, pricing, and automated payment processing
                are not active on the website yet and will only appear once connected to an official
                backend payment provider.
              </p>

              <dl className="mt-6 grid gap-3 sm:grid-cols-2">
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
                <div className="rounded-2xl border border-glass-border p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    VIP / Premium
                  </dt>
                  <dd className="mt-1.5 text-sm font-semibold text-foreground">
                    {connectionQuery.isPending ? "Checking…" : premiumLabel}
                  </dd>
                </div>
                <div className="rounded-2xl border border-glass-border p-4">
                  <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    AI Access
                  </dt>
                  <dd className="mt-1.5 text-sm font-semibold text-foreground">
                    {connectionQuery.isPending ? "Checking…" : aiLabel}
                  </dd>
                </div>
              </dl>
            </div>

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
                <Button
                  asChild
                  variant="neon"
                  size="xl"
                  className="w-full whitespace-nowrap sm:w-auto"
                >
                  <Link to="/dashboard">Connect Discord First</Link>
                </Button>
              )}
              <DiscordButton className="w-full whitespace-nowrap sm:w-auto">
                Join Free City Discord
              </DiscordButton>
            </div>
          </div>

          {/* 16:9 Atmospheric Vault Visual with Fallback Container */}
          <div className="relative min-h-[220px] border-t border-glass-border bg-background/60 lg:min-h-full lg:border-l lg:border-t-0">
            {!bannerFailed ? (
              <img
                src={topupBanner}
                alt="Free City dark metallic vault and gaming controller showcase"
                referrerPolicy="no-referrer"
                onError={() => setBannerFailed(true)}
                className="h-full w-full object-cover object-center lg:absolute lg:inset-0"
              />
            ) : (
              <div className="flex h-full min-h-[220px] flex-col items-center justify-center bg-[radial-gradient(circle_at_center,_oklch(0.28_0.14_305_/_0.45),_oklch(0.12_0.03_280)_75%)] p-6 text-center">
                <Coins className="h-10 w-10 text-electric" />
                <p className="mt-3 font-display text-xl font-extrabold uppercase tracking-wide text-foreground">
                  Free City Supporter Vault
                </p>
              </div>
            )}
            <div
              aria-hidden
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/90 via-background/25 to-transparent lg:bg-gradient-to-r lg:from-background/50 lg:via-transparent lg:to-transparent"
            />
          </div>
        </div>
      </div>

      {/* Interactive Tabs: Overview, Account Readiness, Support & Safety */}
      <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
        <div
          role="tablist"
          aria-label="Game top-up information sections"
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
                ? "bg-neon/25 text-foreground shadow-neon"
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
                ? "bg-neon/25 text-foreground shadow-neon"
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
                ? "bg-neon/25 text-foreground shadow-neon"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            Safety &amp; Notice
          </button>
        </div>

        {activeTab === "overview" && (
          <div className="mt-6 space-y-6">
            <div className="max-w-2xl">
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-wide text-foreground">
                How Official Top-ups Work
              </h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                To keep every member&apos;s balance and perks accurately tied to their Discord and
                character profile, Free City top-ups require verified account linking and
                server-side checkout verification.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-3">
              <div className="rounded-2xl border border-glass-border p-5">
                <p className="font-display text-3xl font-black text-gradient-neon">01</p>
                <h4 className="mt-3 font-display text-lg font-extrabold uppercase tracking-wide text-foreground">
                  Verify Google &amp; Discord
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Link your Discord account on the dashboard so your character ID, guild membership,
                  and roles match.
                </p>
              </div>
              <div className="rounded-2xl border border-glass-border p-5">
                <p className="font-display text-3xl font-black text-gradient-neon">02</p>
                <h4 className="mt-3 font-display text-lg font-extrabold uppercase tracking-wide text-foreground">
                  Backend Checkout Pending
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Official web top-up bundles and payment checkout are awaiting live payment-gateway
                  integration.
                </p>
              </div>
              <div className="rounded-2xl border border-glass-border p-5">
                <p className="font-display text-3xl font-black text-gradient-neon">03</p>
                <h4 className="mt-3 font-display text-lg font-extrabold uppercase tracking-wide text-foreground">
                  Automatic Sync
                </h4>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                  Once enabled, verified supporter perks and VIP tiers reflect automatically in VIP
                  Membership.
                </p>
              </div>
            </div>
          </div>
        )}

        {activeTab === "readiness" && (
          <div className="mt-6 space-y-4">
            <h3 className="font-display text-2xl font-extrabold uppercase tracking-wide text-foreground">
              Your Account Checklist
            </h3>
            <ul className="space-y-3">
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
                        : "Connect your Discord account from Dashboard Home first."}
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
                      {connection
                        ? connection.botSyncedAt
                          ? `Last bot sync: ${formatFirestoreDate(connection.botSyncedAt)}`
                          : isGuildMember
                            ? "Verified in Free City Discord"
                            : "Join the Free City Discord server and refresh your status"
                        : "Available after Discord authorization"}
                    </p>
                  </div>
                </div>
                <span className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
                  {isGuildMember ? "Verified" : "Pending"}
                </span>
              </li>
            </ul>
          </div>
        )}

        {activeTab === "safety" && (
          <div className="mt-6 space-y-4">
            <div className="flex items-center gap-2.5">
              <ShieldCheck className="h-5 w-5 text-electric" />
              <h3 className="font-display text-2xl font-extrabold uppercase tracking-wide text-foreground">
                Official Payment &amp; Security Policy
              </h3>
            </div>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              No third-party payment provider, card form, or transaction history is enabled on this
              page yet. Never send payments to unofficial links or unverified DMs claiming to
              represent Free City Organization.
            </p>
            <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
              For current supporter inquiries or VIP verification help, use the official Free City
              Discord server or visit your VIP Membership and Support pages.
            </p>
          </div>
        )}

        {/* Quick Related Member Routes */}
        <div className="mt-8 grid gap-3 border-t border-glass-border pt-6 sm:grid-cols-3">
          <Link
            to="/dashboard/vip"
            className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-glass-border p-4 transition-colors hover:border-neon/60 hover:bg-white/5"
          >
            <Crown className="h-5 w-5 shrink-0 text-electric" />
            <div>
              <p className="font-semibold text-foreground">VIP Membership</p>
              <p className="text-xs text-muted-foreground">Check synced Premium &amp; AI tier</p>
            </div>
          </Link>
          <Link
            to="/dashboard/game"
            className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-glass-border p-4 transition-colors hover:border-neon/60 hover:bg-white/5"
          >
            <Gamepad2 className="h-5 w-5 shrink-0 text-electric" />
            <div>
              <p className="font-semibold text-foreground">Game Installation</p>
              <p className="text-xs text-muted-foreground">Launch &amp; setup guidance</p>
            </div>
          </Link>
          <Link
            to="/dashboard/support"
            className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-glass-border p-4 transition-colors hover:border-neon/60 hover:bg-white/5"
          >
            <LifeBuoy className="h-5 w-5 shrink-0 text-electric" />
            <div>
              <p className="font-semibold text-foreground">Support</p>
              <p className="text-xs text-muted-foreground">Ask staff in official Discord</p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
