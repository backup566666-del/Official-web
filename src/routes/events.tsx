import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarDays, MapPin, PlusCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { ComingSoonPanel, PageIntro } from "@/components/site/PageIntro";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useSessionUser } from "@/hooks/use-session-user";
import { fetchPublishedEvents, isAdminUser, publishCommunityEvent } from "@/lib/firebase";

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
  const { user } = useSessionUser();
  const isAdmin = isAdminUser(user);
  const queryClient = useQueryClient();

  const [title, setTitle] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [location, setLocation] = useState("");
  const [description, setDescription] = useState("");
  const [publishing, setPublishing] = useState(false);

  const eventsQuery = useQuery({
    queryKey: ["published-events"],
    queryFn: fetchPublishedEvents,
  });

  async function handlePublish(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    setPublishing(true);
    try {
      await publishCommunityEvent(user.uid, {
        title,
        startsAt,
        location,
        description,
      });
      setTitle("");
      setStartsAt("");
      setLocation("");
      setDescription("");
      toast.success("Event published to Free City.");
      await queryClient.invalidateQueries({ queryKey: ["published-events"] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not publish event. Please try again.");
    } finally {
      setPublishing(false);
    }
  }

  const events = eventsQuery.data ?? [];

  return (
    <PageIntro eyebrow="What's happening" title="Events">
      <div className="space-y-8">
        {isAdmin && (
          <div className="glass max-w-2xl rounded-2xl p-6 md:p-8">
            <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold uppercase tracking-wide">
              <PlusCircle className="h-5 w-5 text-electric" /> Publish Event (Admin)
            </h2>
            <form onSubmit={handlePublish} className="mt-5 space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="event-title">Title</Label>
                  <Input
                    id="event-title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Midnight Dockside Meet"
                    minLength={2}
                    maxLength={140}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="event-starts-at">Date &amp; time</Label>
                  <Input
                    id="event-starts-at"
                    value={startsAt}
                    onChange={(e) => setStartsAt(e.target.value)}
                    placeholder="e.g. 2026-12-01 20:00 UTC"
                    minLength={4}
                    maxLength={64}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-location">Location (optional)</Label>
                <Input
                  id="event-location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g. Del Perro Pier / Discord Stage"
                  maxLength={160}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-description">Description</Label>
                <Textarea
                  id="event-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe what's happening in Free City..."
                  minLength={5}
                  maxLength={2000}
                  rows={3}
                  required
                />
              </div>
              <Button type="submit" variant="neon" size="xl" disabled={publishing}>
                {publishing ? "Publishing…" : "Publish event"}
              </Button>
            </form>
          </div>
        )}

        {eventsQuery.isPending ? (
          <div className="glass h-36 max-w-2xl animate-pulse rounded-2xl" aria-label="Loading events" />
        ) : events.length === 0 ? (
          <ComingSoonPanel text="No events have been announced yet. Upcoming community events will be listed here." />
        ) : (
          <div className="grid max-w-4xl gap-5 md:grid-cols-2">
            {events.map((ev) => (
              <article key={ev.id} className="glass rounded-2xl p-6 md:p-8">
                <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-electric">
                  <CalendarDays className="h-4 w-4" /> {ev.startsAt}
                </p>
                <h2 className="mt-2 font-display text-2xl font-extrabold uppercase tracking-wide text-foreground">
                  {ev.title}
                </h2>
                {ev.location && (
                  <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5 text-electric" /> {ev.location}
                  </p>
                )}
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{ev.description}</p>
              </article>
            ))}
          </div>
        )}
      </div>
    </PageIntro>
  );
}
