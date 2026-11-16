import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { ServerRulesBook } from "@/components/rules/ServerRulesBook";
import { DiscordButton } from "@/components/site/DiscordButton";

export const Route = createFileRoute("/_authenticated/dashboard/rules")({
  head: () => ({
    meta: [
      { title: "Server Rules — Member Dashboard — Free City Organization" },
      { name: "description", content: "Official Free City Organization server rules (01–30)." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: RulesPage,
});

function RulesPage() {
  return (
    <section className="space-y-8 pb-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.35em] text-purple-300">
            <ScrollText className="h-4 w-4 text-purple-400" aria-hidden="true" />
            <span>Free City · Official Rule-Based System</span>
          </p>
          <h1 className="hero-title mt-2 font-display text-4xl font-black uppercase leading-[0.92] text-white md:text-5xl">
            Server{" "}
            <span className="bg-gradient-to-r from-purple-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              Rules
            </span>
          </h1>
        </div>
        <DiscordButton className="w-full sm:w-auto">Join Free City Discord</DiscordButton>
      </div>

      <ServerRulesBook />
    </section>
  );
}
