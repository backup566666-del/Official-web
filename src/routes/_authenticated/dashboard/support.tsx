import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, LifeBuoy, ScrollText } from "lucide-react";
import { DiscordButton } from "@/components/site/DiscordButton";
import { DISCORD_INVITE_URL } from "@/lib/site-links";

export const Route = createFileRoute("/_authenticated/dashboard/support")({
  head: () => ({
    meta: [
      { title: "Support — Member Dashboard — Free City Organization" },
      { name: "description", content: "Member support channels for Free City Organization." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SupportPage,
});

function SupportPage() {
  return (
    <section className="space-y-8 pb-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-electric">Help &amp; Assistance</p>
        <h1 className="hero-title mt-2 font-display text-4xl font-black uppercase leading-[0.95] md:text-5xl">
          Support
        </h1>
      </div>

      <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
        <div className="flex items-center gap-3">
          <LifeBuoy className="h-6 w-6 text-electric" />
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">Community &amp; Staff Help</h2>
        </div>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Need help with your character application, account access, or joining Free City? Our moderation and support team handles member assistance inside the official Free City Discord server.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          <DiscordButton className="w-full sm:w-auto">Join Free City Discord</DiscordButton>
          <a
            href={DISCORD_INVITE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-electric underline-offset-4 hover:underline"
          >
            {DISCORD_INVITE_URL}
          </a>
        </div>

        <div className="mt-8 grid gap-3 border-t border-glass-border pt-6 sm:grid-cols-2">
          <Link
            to="/dashboard/applications"
            className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-glass-border p-4 transition-colors hover:border-neon/60 hover:bg-white/5"
          >
            <FileText className="h-5 w-5 shrink-0 text-electric" />
            <div>
              <p className="font-semibold text-foreground">Applications</p>
              <p className="text-xs text-muted-foreground">Check your submitted character applications</p>
            </div>
          </Link>
          <Link
            to="/dashboard/rules"
            className="flex min-h-[60px] items-center gap-3 rounded-2xl border border-glass-border p-4 transition-colors hover:border-neon/60 hover:bg-white/5"
          >
            <ScrollText className="h-5 w-5 shrink-0 text-electric" />
            <div>
              <p className="font-semibold text-foreground">Server Rules</p>
              <p className="text-xs text-muted-foreground">Review official Free City rules status</p>
            </div>
          </Link>
        </div>
      </div>
    </section>
  );
}
