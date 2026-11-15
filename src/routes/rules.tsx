import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPanel, PageIntro } from "@/components/site/PageIntro";

export const Route = createFileRoute("/rules")({
  head: () => ({
    meta: [
      { title: "Server Rules — Free City Organization" },
      { name: "description", content: "The server rules for Free City Roleplay." },
      { property: "og:title", content: "Server Rules — Free City Organization" },
      { property: "og:description", content: "The server rules for Free City Roleplay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PageIntro eyebrow="Play fair" title="Server Rules">
      <ComingSoonPanel text="The official Free City server rules will be published here. Please check back before you begin playing." />
    </PageIntro>
  );
}
