import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPanel, PageIntro } from "@/components/site/PageIntro";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About — Free City Organization" },
      { name: "description", content: "Learn about Free City Organization, an open-world RPG roleplay community." },
      { property: "og:title", content: "About — Free City Organization" },
      { property: "og:description", content: "Learn about Free City Organization, an open-world RPG roleplay community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PageIntro eyebrow="Free City Organization" title="About">
      <ComingSoonPanel text="The full story behind Free City Organization is on its way. Check back soon to learn more about who we are and what we are building." />
    </PageIntro>
  );
}
