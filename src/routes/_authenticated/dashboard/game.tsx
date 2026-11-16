import { createFileRoute } from "@tanstack/react-router";
import { Gamepad2 } from "lucide-react";
import { DiscordButton } from "@/components/site/DiscordButton";

export const Route = createFileRoute("/_authenticated/dashboard/game")({
  head: () => ({
    meta: [
      { title: "Game Website & Installation — Member Dashboard — Free City Organization" },
      { name: "description", content: "Official Free City Roleplay installation and connection instructions." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: GameInstallationPage,
});

function GameInstallationPage() {
  return (
    <section className="space-y-8 pb-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-electric">Play Free City</p>
        <h1 className="hero-title mt-2 font-display text-4xl font-black uppercase leading-[0.95] md:text-5xl">
          Game Website &amp; Installation
        </h1>
      </div>

      <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
        <div className="flex items-center gap-3">
          <Gamepad2 className="h-6 w-6 text-electric" />
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">Installation &amp; Launch Guide</h2>
        </div>
        <p className="mt-4 max-w-2xl leading-relaxed text-muted-foreground">
          Official Free City Roleplay game download links, launcher instructions, and server connection details are distributed through our Discord community and will be linked here once published.
        </p>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Always verify downloads directly through official Free City channels before installing any client files.
        </p>
        <div className="mt-6">
          <DiscordButton className="w-full sm:w-auto">Join Free City Discord</DiscordButton>
        </div>
      </div>
    </section>
  );
}
