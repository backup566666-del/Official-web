import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { CalendarDays, MapPin, PlusCircle } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchPublishedEvents, isAdminUser, publishCommunityEvent } from "@/lib/firebase";

export const Route = createFileRoute("/_authenticated/dashboard/events")({
  head: () => ({
    meta: [
      { title: "Events — Member Dashboard — Free City Organization" },
      { name: "description", content: "Upcoming community events in Free City Roleplay." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: DashboardEventsPage,
});

function DashboardEventsPage() {
  const { user } = Route.useRouteContext();
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
    <section className="space-y-8 pb-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-electric">What's happening</p>
        <h1 className="hero-title mt-2 font-display text-4xl font-black uppercase leading-[0.95] md:text-5xl">Events</h1>
      </div>

      {isAdmin && (
        <div className="glass rounded-3xl p-6 md:p-8">
          <h2 className="flex items-center gap-2 font-display text-2xl font-extrabold uppercase tracking-wide">
            <PlusCircle className="h-5 w-5 text-electric" /> Publish Event (Admin)
          </h2>
          <form onSubmit={handlePublish} className="mt-5 space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="dashboard-event-title">Title</Label>
                <Input
                  id="dashboard-event-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Midnight Dockside Meet"
                  minLength={2}
                  maxLength={140}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="dashboard-event-starts-at">Date &amp; time</Label>
                <Input
                  id="dashboard-event-starts-at"
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
              <Label htmlFor="dashboard-event-location">Location (optional)</Label>
              <Input
                id="dashboard-event-location"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Del Perro Pier / Discord Stage"
                maxLength={160}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dashboard-event-description">Description</Label>
              <Textarea
                id="dashboard-event-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe what's happening in Free City..."
                minLength={5}
                maxLength={2000}
                rows={3}
                required
              />
            </div>
            <Button type="submit" variant="neon" size="xl" className="w-full sm:w-auto" disabled={publishing}>
              {publishing ? "Publishing…" : "Publish event"}
            </Button>
          </form>
        </div>
      )}

      {eventsQuery.isPending ? (
        <div className="glass h-36 animate-pulse rounded-3xl" aria-label="Loading events" />
      ) : events.length === 0 ? (
        <div className="glass rounded-3xl p-6 md:p-8">
          <p className="leading-relaxed text-muted-foreground">
            No events have been announced yet. Upcoming community events will be listed here.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {events.map((ev) => (
            <article key={ev.id} className="glass rounded-3xl p-6 md:p-8">
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
    </section>
  );
}
