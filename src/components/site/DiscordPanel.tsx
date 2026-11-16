import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, RefreshCw, Unlink, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DiscordButton } from "@/components/site/DiscordButton";
import { DiscordIcon } from "@/components/site/DiscordIcon";
import {
  completeDiscordOAuth,
  disconnectDiscordAccount,
  startDiscordOAuth,
  syncDiscordConnection,
} from "@/lib/discord-client";
import { auth, fetchDiscordConnection, formatFirestoreDate, type DiscordConnectionDoc } from "@/lib/firebase";
import { DISCORD_OAUTH_MESSAGE_TYPE } from "@/routes/discord.callback";

type Tone = "good" | "neutral" | "warn";

function StatusRow({
  label,
  value,
  tone,
  detail,
}: {
  label: string;
  value: string;
  tone: Tone;
  detail?: string | undefined;
}) {
  const dot = tone === "good" ? "bg-electric" : tone === "warn" ? "bg-destructive" : "bg-muted-foreground";
  return (
    <div className="rounded-2xl border border-glass-border p-5">
      <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</dt>
      <dd className="mt-2 flex items-center gap-2 text-foreground tabular-nums">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        <span className="break-words">{value}</span>
      </dd>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function serverStatus(connection: DiscordConnectionDoc): { value: string; tone: Tone } {
  switch (connection.guildStatus) {
    case "member":
      return {
        value: connection.guildPending ? "Joined — rules screening not finished" : "Member of the Free City Discord",
        tone: connection.guildPending ? "neutral" : "good",
      };
    case "not_member":
      return { value: "Not in the Free City Discord", tone: "neutral" };
    case "reconnect_required":
      return { value: "Reconnect Discord to check", tone: "warn" };
    default:
      return { value: "Not verified yet", tone: "neutral" };
  }
}

function botSyncDetail(connection: DiscordConnectionDoc | null): string | undefined {
  if (!connection) return "Not connected";
  switch (connection.botSyncStatus) {
    case "synced":
      return connection.botSyncedAt ? `Synced ${formatFirestoreDate(connection.botSyncedAt)}` : "Synced from Free City API";
    case "not_configured":
      return "Railway API not configured";
    case "not_found":
      return "No bot record yet";
    case "error":
      return "Sync error — retry later";
    default:
      return "Not synchronized yet";
  }
}

export function DiscordPanel({ userId }: { userId: string }) {
  const queryClient = useQueryClient();
  const [busyAction, setBusyAction] = useState<"connect" | "sync" | "disconnect" | null>(null);

  const connectionQuery = useQuery({
    queryKey: ["discord-connection", userId],
    queryFn: () => fetchDiscordConnection(userId),
  });

  useEffect(() => {
    function handleOAuthMessage(event: MessageEvent) {
      const origin = event.origin;
      const allowedOrigin =
        origin === window.location.origin || origin.endsWith(".run.app") || origin.includes("localhost");
      if (!allowedOrigin) return;

      const data = event.data as { type?: unknown; code?: unknown; state?: unknown; error?: unknown } | null;
      if (!data || data.type !== DISCORD_OAUTH_MESSAGE_TYPE) return;

      if (typeof data.error === "string" && data.error) {
        setBusyAction(null);
        toast.error(
          data.error === "access_denied"
            ? "You cancelled the Discord authorization."
            : "Discord didn't authorize the connection.",
        );
        return;
      }

      const code = typeof data.code === "string" ? data.code : "";
      const state = typeof data.state === "string" ? data.state : "";
      const currentUser = auth.currentUser;
      if (!code || !state || !currentUser) {
        setBusyAction(null);
        toast.error("Could not verify your Discord authorization. Please try again.");
        return;
      }

      setBusyAction("connect");
      void completeDiscordOAuth(currentUser, code, state)
        .then(async (result) => {
          await queryClient.invalidateQueries({ queryKey: ["discord-connection", userId] });
          if (result.botSyncStatus === "synced") {
            toast.success("Discord account connected and synced with Free City.");
          } else {
            toast.success("Discord account connected.");
          }
        })
        .catch((err) => {
          toast.error(err instanceof Error ? err.message : "Could not finish connecting Discord.");
        })
        .finally(() => {
          setBusyAction(null);
        });
    }

    window.addEventListener("message", handleOAuthMessage);
    return () => window.removeEventListener("message", handleOAuthMessage);
  }, [queryClient, userId]);

  async function handleConnectDiscord() {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      toast.error("Please sign in with your Google account first.");
      return;
    }

    setBusyAction("connect");
    try {
      const { url } = await startDiscordOAuth(currentUser);
      const popup = window.open(url, "discord_oauth", "width=600,height=720");
      if (!popup) {
        // Mobile or popup-blocker fallback: navigate directly in the top window
        window.location.assign(url);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not start Discord authorization.");
      setBusyAction(null);
    }
  }

  async function handleSync() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setBusyAction("sync");
    try {
      const result = await syncDiscordConnection(currentUser);
      await queryClient.invalidateQueries({ queryKey: ["discord-connection", userId] });
      if (result.botSyncStatus === "synced") {
        toast.success("Discord profile and Free City bot stats updated.");
      } else {
        toast.info(result.message || "Discord status refreshed; Free City bot data is not synchronized yet.");
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not sync Discord stats.");
    } finally {
      setBusyAction(null);
    }
  }

  async function handleDisconnect() {
    const currentUser = auth.currentUser;
    if (!currentUser) return;
    setBusyAction("disconnect");
    try {
      await disconnectDiscordAccount(currentUser);
      await queryClient.invalidateQueries({ queryKey: ["discord-connection", userId] });
      toast.success("Discord account disconnected.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not disconnect Discord.");
    } finally {
      setBusyAction(null);
    }
  }

  const connection = connectionQuery.data ?? null;
  const isMember = connection?.guildStatus === "member";
  const syncDetail = botSyncDetail(connection);

  const rolesText =
    connection?.roles && connection.roles.length > 0
      ? connection.roles.join(", ")
      : connection?.roleIds && connection.roleIds.length > 0
        ? `${connection.roleIds.length} server role ID(s) detected`
        : connection
          ? "No synced roles yet"
          : "Available after Discord authorization";

  const levelText = typeof connection?.level === "number" ? String(connection.level) : "—";
  const xpText = typeof connection?.xp === "number" ? String(connection.xp) : "—";
  const messageCountText = typeof connection?.messageCount === "number" ? String(connection.messageCount) : "—";

  const premiumText = !connection
    ? "Not connected"
    : typeof connection.premiumActive === "boolean"
      ? connection.premiumActive
        ? connection.premiumTier
          ? `Active (${connection.premiumTier})`
          : "Active"
        : "Not active"
      : connection.vipStatus || "Not synchronized yet";

  const aiAccessText = !connection
    ? "Not connected"
    : typeof connection.aiAccessEnabled === "boolean"
      ? connection.aiAccessEnabled
        ? connection.aiAccessTier
          ? `Enabled (${connection.aiAccessTier})`
          : "Enabled"
        : "Not enabled"
      : "Not synchronized yet";

  return (
    <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold uppercase tracking-wide">
          <DiscordIcon className="h-6 w-6 text-electric" /> Discord Profile
        </h2>
        <span className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {connection ? "Connected" : "NOT CONNECTED"}
        </span>
      </div>

      {connectionQuery.isPending ? (
        <div className="mt-6 h-32 animate-pulse rounded-2xl border border-glass-border" aria-label="Loading Discord status" />
      ) : connectionQuery.isError ? (
        <div className="mt-4">
          <p className="text-muted-foreground">We couldn't load your Discord link status right now.</p>
          <Button variant="glass" size="xl" className="mt-4" onClick={() => connectionQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-4">
            {connection?.avatarUrl ? (
              <img
                src={connection.avatarUrl}
                alt={`${connection.globalName ?? connection.username}'s Discord avatar`}
                referrerPolicy="no-referrer"
                width={64}
                height={64}
                className="h-16 w-16 shrink-0 rounded-full border border-glass-border object-cover"
              />
            ) : (
              <span
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full border border-glass-border bg-white/5 text-muted-foreground"
                aria-hidden="true"
              >
                <UserRound className="h-7 w-7" />
              </span>
            )}
            <div className="min-w-0">
              {connection ? (
                <>
                  <p className="break-words text-lg font-semibold text-foreground">
                    {connection.globalName ?? connection.username}
                  </p>
                  <p className="break-all text-sm text-muted-foreground">@{connection.username}</p>
                  <p className="break-all text-xs text-muted-foreground">Discord ID {connection.discordUserId}</p>
                </>
              ) : (
                <>
                  <p className="text-base font-semibold text-foreground">Discord Username: Not connected</p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Connect your Discord account with OAuth2 to verify your Free City server membership and retrieve
                    your roles, XP, level, Premium subscription, and AI access.
                  </p>
                </>
              )}
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <StatusRow
              label="Connection status"
              value={connection ? "Connected" : "NOT CONNECTED"}
              tone={connection ? "good" : "neutral"}
              detail={connection ? `Linked ${formatFirestoreDate(connection.connectedAt)}` : "Manual OAuth required"}
            />
            <StatusRow
              label="Free City server"
              {...(connection
                ? serverStatus(connection)
                : { value: "Not verified yet", tone: "neutral" as const, detail: "Connect Discord first" })}
            />
            <StatusRow label="Discord roles" value={rolesText} tone={connection?.roles?.length ? "good" : "neutral"} />
            <StatusRow
              label="Level"
              value={levelText}
              tone={typeof connection?.level === "number" ? "good" : "neutral"}
              detail={typeof connection?.level === "number" ? syncDetail : syncDetail}
            />
            <StatusRow
              label="XP"
              value={xpText}
              tone={typeof connection?.xp === "number" ? "good" : "neutral"}
              detail={typeof connection?.xp === "number" ? syncDetail : syncDetail}
            />
            <StatusRow
              label="Messages"
              value={messageCountText}
              tone={typeof connection?.messageCount === "number" ? "good" : "neutral"}
              detail={syncDetail}
            />
            <StatusRow
              label="Premium subscription"
              value={premiumText}
              tone={connection?.premiumActive ? "good" : "neutral"}
              detail={connection?.premiumExpiresAt ? `Expires ${formatFirestoreDate(connection.premiumExpiresAt)}` : syncDetail}
            />
            <StatusRow
              label="AI access"
              value={aiAccessText}
              tone={connection?.aiAccessEnabled ? "good" : "neutral"}
              detail={syncDetail}
            />
          </dl>
        </div>
      )}

      <div className="mt-8 flex flex-col gap-3 border-t border-glass-border pt-6 sm:flex-row sm:flex-wrap">
        {(!connection || connection.guildStatus === "reconnect_required") && (
          <Button
            type="button"
            variant="neon"
            size="xl"
            className="w-full sm:w-auto"
            onClick={handleConnectDiscord}
            disabled={busyAction !== null}
          >
            <Link2 className="h-4 w-4" />
            {busyAction === "connect" ? "Connecting…" : "Connect Discord Account"}
          </Button>
        )}

        {connection && (
          <>
            <Button
              type="button"
              variant="glass"
              size="xl"
              className="w-full sm:w-auto"
              onClick={handleSync}
              disabled={busyAction !== null}
            >
              <RefreshCw className={busyAction === "sync" ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
              {busyAction === "sync" ? "Syncing…" : "Sync from Free City API"}
            </Button>
            <Button
              type="button"
              variant="glass"
              size="xl"
              className="w-full sm:w-auto"
              onClick={handleDisconnect}
              disabled={busyAction !== null}
            >
              <Unlink className="h-4 w-4" />
              {busyAction === "disconnect" ? "Disconnecting…" : "Disconnect Discord"}
            </Button>
          </>
        )}

        {!isMember && <DiscordButton className="w-full sm:w-auto">Join Free City Discord</DiscordButton>}
      </div>
    </div>
  );
}
