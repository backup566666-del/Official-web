import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { RefreshCw, Unlink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DiscordButton } from "@/components/site/DiscordButton";
import { DiscordIcon } from "@/components/site/DiscordIcon";
import {
  checkDiscordMembership,
  disconnectDiscord,
  getDiscordStatus,
  startDiscordConnect,
  type DiscordStatus,
} from "@/lib/discord.functions";

function formatDate(value: string) {
  return new Date(value).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" });
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

type Tone = "good" | "neutral" | "warn";

function StatusRow({ label, value, tone, detail }: { label: string; value: string; tone: Tone; detail?: string | undefined }) {
  const dot = tone === "good" ? "bg-electric" : tone === "warn" ? "bg-destructive" : "bg-muted-foreground";
  return (
    <div className="rounded-2xl border border-glass-border p-5">
      <dt className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">{label}</dt>
      <dd className="mt-2 flex items-center gap-2 text-foreground">
        <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} aria-hidden="true" />
        {value}
      </dd>
      {detail && <p className="mt-1 text-xs text-muted-foreground">{detail}</p>}
    </div>
  );
}

function serverStatus(status: DiscordStatus): { value: string; tone: Tone; detail?: string | undefined } {
  const c = status.connection!;
  if (!status.guildConfigured) return { value: "Server check not set up yet", tone: "neutral" };
  const checked = c.guildCheckedAt ? `Last checked ${formatDateTime(c.guildCheckedAt)}` : undefined;
  switch (c.guildStatus) {
    case "member":
      return {
        value: c.guildPending ? "Joined — rules screening not finished" : "Member of the Free City Discord",
        tone: c.guildPending ? "neutral" : "good",
        detail: [c.guildJoinedAt ? `Joined ${formatDate(c.guildJoinedAt)}` : null, checked].filter(Boolean).join(" · ") || undefined,
      };
    case "not_member":
      return { value: "Not in the Free City Discord", tone: "neutral", detail: checked };
    case "reconnect_required":
      return { value: "Reconnect Discord to check", tone: "warn", detail: checked };
    default:
      return { value: "Not checked yet", tone: "neutral" };
  }
}

export function DiscordPanel({ userId, hasSupabaseSession = true }: { userId: string; hasSupabaseSession?: boolean }) {
  const queryClient = useQueryClient();
  const fetchStatus = useServerFn(getDiscordStatus);
  const start = useServerFn(startDiscordConnect);
  const check = useServerFn(checkDiscordMembership);
  const disconnect = useServerFn(disconnectDiscord);
  const [busy, setBusy] = useState<null | "connect" | "check" | "disconnect">(null);

  const statusQuery = useQuery({
    queryKey: ["discord-status", userId],
    queryFn: () => fetchStatus(),
    enabled: hasSupabaseSession,
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["discord-status", userId] });

  async function handleConnect() {
    setBusy("connect");
    // Discord's consent page can't open inside a frame (like the editor preview), so use a new tab there.
    const framed = window.self !== window.top;
    const tab = framed ? window.open("", "_blank") : null;
    try {
      const result = await start({ data: { origin: window.location.origin } });
      if (!result.ok) {
        tab?.close();
        toast.error(result.message);
        return;
      }
      if (tab) {
        tab.opener = null;
        tab.location.href = result.url;
        toast("Finish connecting Discord in the new tab", {
          description: "Come back here afterwards — your status updates automatically.",
        });
      } else {
        window.location.assign(result.url);
        return;
      }
    } catch {
      tab?.close();
      toast.error("Couldn't start the Discord connection. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleCheck() {
    setBusy("check");
    try {
      const result = await check();
      if (!result.ok) toast.error(result.message);
      await refresh();
    } catch {
      toast.error("Couldn't check with Discord. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function handleDisconnect() {
    setBusy("disconnect");
    try {
      const result = await disconnect();
      if (!result.ok) toast.error(result.message);
      else toast("Discord disconnected");
      await refresh();
    } catch {
      toast.error("Couldn't disconnect Discord. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  const status = statusQuery.data;
  const connection = status?.connection ?? null;
  const isMember = connection?.guildStatus === "member";

  return (
    <div className="animate-fade-up glass mt-8 rounded-3xl p-6 md:p-10">
      <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold uppercase tracking-wide">
        <DiscordIcon className="h-6 w-6 text-electric" /> Discord
      </h2>

      {!hasSupabaseSession ? (
        <div className="mt-4 space-y-4">
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            Discord account linking requires the Supabase database configuration to store member connections.
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <StatusRow label="Discord account" value="Database not connected" tone="neutral" />
          </dl>
        </div>
      ) : statusQuery.isPending ? (
        <div className="mt-6 h-24 animate-pulse rounded-2xl border border-glass-border" aria-label="Loading Discord status" />
      ) : statusQuery.isError || !status ? (
        <div className="mt-4">
          <p className="text-muted-foreground">We couldn't load your Discord status right now.</p>
          <Button variant="glass" size="xl" className="mt-4" onClick={() => statusQuery.refetch()}>
            Try again
          </Button>
        </div>
      ) : !connection ? (
        <div className="mt-4 space-y-4">
          <p className="max-w-xl text-sm leading-relaxed text-muted-foreground">
            {status.oauthConfigured
              ? "Connect your Discord account to link it to your Free City member profile. We save your Discord username, ID and avatar."
              : "Connecting Discord accounts isn't switched on yet. Check back soon."}
          </p>
          <dl className="grid gap-3 sm:grid-cols-2">
            <StatusRow label="Discord account" value="Not connected" tone="neutral" />
          </dl>
          {status.oauthConfigured && (
            <Button variant="glass" size="xl" onClick={handleConnect} disabled={busy !== null}>
              <DiscordIcon className="h-5 w-5" /> {busy === "connect" ? "Opening Discord…" : "Connect Discord"}
            </Button>
          )}
        </div>
      ) : (
        <div className="mt-6 space-y-6">
          <div className="flex items-center gap-4">
            <img
              src={connection.avatarUrl}
              alt={`${connection.globalName ?? connection.username}'s Discord avatar`}
              referrerPolicy="no-referrer"
              width={64}
              height={64}
              className="h-16 w-16 rounded-full border border-glass-border object-cover"
            />
            <div className="min-w-0">
              <p className="break-words text-lg font-semibold text-foreground">{connection.globalName ?? connection.username}</p>
              <p className="break-all text-sm text-muted-foreground">@{connection.username}</p>
              <p className="break-all text-xs text-muted-foreground">Discord ID {connection.discordUserId}</p>
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-2">
            <StatusRow
              label="Discord account"
              value="Connected"
              tone="good"
              detail={`Since ${formatDate(connection.connectedAt)}`}
            />
            <StatusRow label="Free City server" {...serverStatus(status)} />
          </dl>

          <div className="flex flex-wrap gap-3">
            {status.guildConfigured && connection.guildStatus === "reconnect_required" ? (
              <Button variant="glass" size="xl" onClick={handleConnect} disabled={busy !== null}>
                <DiscordIcon className="h-5 w-5" /> {busy === "connect" ? "Opening Discord…" : "Reconnect Discord"}
              </Button>
            ) : status.guildConfigured ? (
              <Button variant="glass" size="xl" onClick={handleCheck} disabled={busy !== null}>
                <RefreshCw className={busy === "check" ? "animate-spin" : undefined} />
                {busy === "check" ? "Checking…" : "Check again"}
              </Button>
            ) : null}
            <Button variant="ghost" size="xl" onClick={handleDisconnect} disabled={busy !== null}>
              <Unlink /> {busy === "disconnect" ? "Disconnecting…" : "Disconnect"}
            </Button>
          </div>
        </div>
      )}

      {!isMember && (
        <div className="mt-8 border-t border-glass-border pt-6">
          <DiscordButton>Join Free City Discord</DiscordButton>
        </div>
      )}
    </div>
  );
}
