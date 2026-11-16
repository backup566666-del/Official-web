import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { DiscordButton } from "@/components/site/DiscordButton";

export const Route = createFileRoute("/_authenticated/dashboard/rules")({
  head: () => ({
    meta: [
      { title: "Server Rules — Member Dashboard — Free City Organization" },
      { name: "description", content: "Official Free City Organization server rules." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RulesPage,
});

function RulesPage() {
  return (
    <section className="space-y-8 pb-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-electric">Play fair</p>
        <h1 className="hero-title mt-2 font-display text-4xl font-black uppercase leading-[0.95] md:text-5xl">
          Server Rules
        </h1>
      </div>

      <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
        <div className="flex items-center gap-3">
          <ScrollText className="h-6 w-6 text-electric" />
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">Official Rulebook</h2>
        </div>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          The official Free City server rules will be published here. Please check back before you begin playing.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          While the web rulebook is being finalized, community announcements and Discord onboarding guidelines are posted in the official Free City Discord server.
        </p>
        <div className="mt-6">
          <DiscordButton className="w-full sm:w-auto">Join Free City Discord</DiscordButton>
        </div>
      </div>
    </section>
  );
}
