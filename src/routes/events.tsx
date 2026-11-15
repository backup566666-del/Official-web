import { createFileRoute } from "@tanstack/react-router";
import { ComingSoonPanel, PageIntro } from "@/components/site/PageIntro";

export const Route = createFileRoute("/events")({
  head: () => ({
    meta: [
      { title: "Events — Free City Organization" },
      { name: "description", content: "Upcoming events in the Free City roleplay community." },
      { property: "og:title", content: "Events — Free City Organization" },
      { property: "og:description", content: "Upcoming events in the Free City roleplay community." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

function Page() {
  return (
    <PageIntro eyebrow="What's happening" title="Events">
      <ComingSoonPanel text="No events have been announced yet. Upcoming community events will be listed here." />
    </PageIntro>
  );
}
