import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { PageIntro } from "@/components/site/PageIntro";
import { Button } from "@/components/ui/button";
import { completeDiscordConnect } from "@/lib/discord.functions";

// Discord sends members back here. Public on purpose: Discord's return address must not be a
// members-only page. Finishing still requires the same signed-in member who started it.
export const PENDING_DISCORD_KEY = "fc-discord-pending";

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

type Phase = { kind: "working" } | { kind: "signin" } | { kind: "error"; message: string };

function DiscordCallback() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const complete = useServerFn(completeDiscordConnect);
  const [phase, setPhase] = useState<Phase>({ kind: "working" });
  const running = useRef(false);

  const run = useCallback(async () => {
    if (running.current) return;
    running.current = true;
    try {
      const params = new URLSearchParams(window.location.search);
      const discordError = params.get("error");
      const code = params.get("code");
      const state = params.get("state");
      if (discordError) {
        sessionStorage.removeItem(PENDING_DISCORD_KEY);
        setPhase({
          kind: "error",
          message: discordError === "access_denied" ? "You cancelled the Discord connection." : "Discord didn't complete the connection.",
        });
        return;
      }
      if (code && state) {
        sessionStorage.setItem(PENDING_DISCORD_KEY, JSON.stringify({ code, state }));
        window.history.replaceState(null, "", window.location.pathname);
      }
      const raw = sessionStorage.getItem(PENDING_DISCORD_KEY);
      if (!raw) {
        setPhase({ kind: "error", message: "No Discord connection is in progress." });
        return;
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        setPhase({ kind: "signin" });
        return;
      }
      sessionStorage.removeItem(PENDING_DISCORD_KEY);
      const pending = JSON.parse(raw) as { code: string; state: string };
      const result = await complete({ data: pending });
      if (!result.ok) {
        setPhase({ kind: "error", message: result.message });
        return;
      }
      await queryClient.invalidateQueries({ queryKey: ["discord-status"] });
      toast.success("Discord connected");
      navigate({ to: "/dashboard", replace: true });
    } catch {
      setPhase({ kind: "error", message: "Couldn't finish the Discord connection. Please try again from your dashboard." });
    } finally {
      running.current = false;
    }
  }, [complete, navigate, queryClient]);

  useEffect(() => {
    void run();
  }, [run]);

  return (
    <PageIntro eyebrow="Members" title="Discord">
      <div className="glass max-w-md space-y-5 rounded-2xl p-6 md:p-8">
        {phase.kind === "working" && <p className="text-muted-foreground">Connecting your Discord account…</p>}
        {phase.kind === "signin" && (
          <>
            <p className="text-muted-foreground">
              Sign in to your Free City account in this window to finish connecting Discord.
            </p>
            <Button asChild variant="neon" size="xl">
              <Link to="/login">Sign in to finish</Link>
            </Button>
          </>
        )}
        {phase.kind === "error" && (
          <>
            <p role="alert" className="text-foreground">{phase.message}</p>
            <Button asChild variant="glass" size="xl">
              <Link to="/dashboard">Back to dashboard</Link>
            </Button>
          </>
        )}
      </div>
    </PageIntro>
  );
}
