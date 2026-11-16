import { createFileRoute } from "@tanstack/react-router";
import { ScrollText } from "lucide-react";
import { ServerRulesBook } from "@/components/rules/ServerRulesBook";
import { DiscordButton } from "@/components/site/DiscordButton";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Server Rules — Free City Organization" },
      {
        name: "description",
        content:
          "Official Free City Roleplay server rules (01–30). Review roleplay, gameplay, economy, communication, and staff conduct standards.",
      },
      { property: "og:title", content: "Server Rules — Free City Organization" },
      {
        property: "og:description",
        content:
          "Official Free City Roleplay server rules (01–30). Review roleplay, gameplay, economy, communication, and staff conduct standards.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RulesPage,
});

function RulesPage() {
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#06030c]/90 via-[#0e061e]/92 to-[#050209]/96">
      {/* Subtle deep-purple atmospheric radial glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[440px] bg-[radial-gradient(ellipse_at_top,_rgba(168,85,247,0.22),_transparent_70%)]"
      />

      <section className="relative mx-auto max-w-6xl px-5 pb-24 pt-28 md:px-8 md:pt-36">
        {/* Free City Branding Header */}
        <header className="animate-fade-up max-w-3xl">
          <div className="flex items-center gap-2.5 text-xs font-bold uppercase tracking-[0.35em] text-purple-300">
            <ScrollText className="h-4 w-4 text-purple-400" aria-hidden="true" />
            <span>Free City · Official Game &amp; Community Rule-Based System</span>
          </div>

          <h1 className="hero-title mt-4 text-balance font-display text-5xl font-black uppercase leading-[0.88] text-white sm:text-6xl md:text-7xl">
            Free City —{" "}
            <span className="bg-gradient-to-r from-purple-300 via-purple-400 to-fuchsia-400 bg-clip-text text-transparent">
              Project Rules
            </span>
          </h1>

          <p className="mt-4 max-w-2xl text-base leading-relaxed text-purple-100/80 md:text-lg">
            Official server rulebook for Free City Organization. Every player is expected to know
            and follow these 30 rules across roleplay, gameplay, economy, communication, and staff
            conduct.
          </p>
        </header>

        {/* Interactive 30-Rule Directory */}
        <div className="animate-fade-up mt-8 md:mt-10" style={{ animationDelay: "120ms" }}>
          <ServerRulesBook />
        </div>

        {/* Community Footer CTA */}
        <div className="mt-12 rounded-2xl border border-purple-500/35 bg-[#0c0519]/90 p-6 md:flex md:items-center md:justify-between md:gap-6 md:p-8">
          <div className="max-w-xl">
            <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide text-purple-200 md:text-3xl">
              Questions or rule clarifications?
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-purple-100/75 md:text-base">
              Join the official Free City Discord server to connect with the community or reach out
              to staff before stepping into the city.
            </p>
          </div>
          <div className="mt-5 shrink-0 md:mt-0">
            <DiscordButton className="w-full sm:w-auto">Join Free City Discord</DiscordButton>
          </div>
        </div>
      </section>
    </div>
  );
}
