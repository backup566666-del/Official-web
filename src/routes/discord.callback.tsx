import { useQueryClient } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { completeDiscordOAuth } from "@/lib/discord-client";
import { auth } from "@/lib/firebase";
import { PageIntro } from "@/components/site/PageIntro";
import { Button } from "@/components/ui/button";

// Discord sends members back here. Public on purpose: Discord's return address must not be a
// members-only page.
export const DISCORD_OAUTH_MESSAGE_TYPE = "DISCORD_OAUTH_RESULT";

export const Route = createFileRoute("/discord/callback")({
  head: () => ({
    meta: [
      { title: "Connecting Discord — Free City Organization" },
      { name: "description", content: "Finishing your Discord connection to your Free City member account." },
      { property: "og:title", content: "Connecting Discord — Free City Organization" },
      { property: "og:description", content: "Finishing your Discord connection to your Free City member account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DiscordCallback,
});

type Phase =
  | { kind: "working" }
  | { kind: "signin" }
  | { kind: "done"; message: string }
  | { kind: "error"; message: string };

function DiscordCallback() {
  const [phase, setPhase] = useState<Phase>({ kind: "working" });
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    let active = true;
    const params = new URLSearchParams(window.location.search);
    const discordError = params.get("error");
    const code = params.get("code");
    const state = params.get("state");

    if (code || state || discordError) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    // Popup flow (preferred in AI Studio iframe): forward code & state back to the opener tab.
    if (window.opener) {
      try {
        window.opener.postMessage(
          {
            type: DISCORD_OAUTH_MESSAGE_TYPE,
            code,
            state,
            error: discordError,
          },
          "*",
        );
        window.close();
      } catch {
        // Fall through to status UI below if popup self-close is blocked
      }
      setPhase({
        kind: discordError ? "error" : "done",
        message: discordError
          ? discordError === "access_denied"
            ? "You cancelled the Discord connection. You can close this window."
            : "Discord didn't complete the authorization. You can close this window."
          : "Authorization received. Finishing setup in your Free City dashboard—you may close this window.",
      });
      return () => {
        active = false;
      };
    }

    if (discordError) {
      setPhase({
        kind: "error",
        message:
          discordError === "access_denied"
            ? "You cancelled the Discord connection."
            : "Discord didn't complete the authorization.",
      });
      return () => {
        active = false;
      };
    }

    if (!code || !state) {
      setPhase({
        kind: "error",
        message: "Missing Discord authorization parameters. Please start from your dashboard.",
      });
      return () => {
        active = false;
      };
    }

    void auth.authStateReady().then(async () => {
      if (!active) return;
      const currentUser = auth.currentUser;
      if (!currentUser) {
        setPhase({ kind: "signin" });
        return;
      }

      try {
        const result = await completeDiscordOAuth(currentUser, code, state);
        if (!active) return;
        await queryClient.invalidateQueries({ queryKey: ["discord-connection", currentUser.uid] });
        setPhase({
          kind: "done",
          message:
            result.botSyncStatus === "synced"
              ? "Your Discord account and Free City profile are now connected."
              : "Your Discord account is connected. Bot progression sync will populate once the Railway API responds.",
        });
        setTimeout(() => {
          if (active) navigate({ to: "/dashboard", replace: true });
        }, 1200);
      } catch (err) {
        if (!active) return;
        setPhase({
          kind: "error",
          message: err instanceof Error ? err.message : "Could not complete Discord linking.",
        });
      }
    });

    return () => {
      active = false;
    };
  }, [navigate, queryClient]);

  return (
    <PageIntro eyebrow="Members" title="Discord">
      <div className="glass max-w-md space-y-5 rounded-2xl p-6 md:p-8">
        {phase.kind === "working" && <p className="text-muted-foreground">Completing your Discord connection…</p>}
        {phase.kind === "signin" && (
          <>
            <p className="text-muted-foreground">
              Sign in to your Free City Google account first, then connect Discord from your member dashboard.
            </p>
            <Button asChild variant="neon" size="xl">
              <Link to="/login">Sign in</Link>
            </Button>
          </>
        )}
        {(phase.kind === "done" || phase.kind === "error") && (
          <>
            <p className={phase.kind === "error" ? "text-destructive" : "text-foreground"}>{phase.message}</p>
            <Button asChild variant="glass" size="xl">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </>
        )}
      </div>
    </PageIntro>
  );
}
