import { createFileRoute } from "@tanstack/react-router";
import { DiscordButton } from "@/components/site/DiscordButton";
import { DiscordIcon } from "@/components/site/DiscordIcon";
import { ComingSoonPanel, PageIntro } from "@/components/site/PageIntro";
import { DISCORD_INVITE_URL } from "@/lib/site-links";

export const Route = createFileRoute("/community")({
  head: () => ({
    meta: [
      { title: "Community — Free City Organization" },
      { name: "description", content: "Meet the players and creators of the Free City roleplay community." },
      { property: "og:title", content: "Community — Free City Organization" },
      { property: "og:description", content: "Meet the players and creators of the Free City roleplay community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PageIntro eyebrow="Meet the city" title="Community">
      <div className="space-y-6">
        <div className="glass rounded-2xl p-6 md:p-10">
          <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold uppercase tracking-wide md:text-3xl">
            <DiscordIcon className="h-6 w-6 text-electric" /> Official Free City Discord
          </h2>
          <p className="mt-3 max-w-2xl text-base leading-relaxed text-muted-foreground">
            Connect with Free City Organization members, stay up to date on community announcements, and find roleplay
            groups in our official Discord server.
          </p>
          <p className="mt-3 break-all text-sm text-muted-foreground">
            Invitation link:{" "}
            <a
              href={DISCORD_INVITE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-electric underline underline-offset-4 transition-colors hover:text-foreground"
            >
              {DISCORD_INVITE_URL}
            </a>
          </p>
          <div className="mt-6 flex flex-col items-stretch sm:flex-row sm:items-center">
            <DiscordButton>Join our Discord</DiscordButton>
          </div>
        </div>

        <ComingSoonPanel text="Community spotlights and ways to connect with other players will appear here soon." />
      </div>
    </PageIntro>
  );
}
