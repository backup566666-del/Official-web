import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPanel, PageIntro } from "@/components/site/PageIntro";

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
      <ComingSoonPanel text="Community spotlights and ways to connect with other players will appear here soon." />
    </PageIntro>
  );
}
