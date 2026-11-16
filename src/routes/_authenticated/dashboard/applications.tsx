import { useQuery, useQueryClient } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { FileText, Send } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { fetchMemberApplications, formatFirestoreDate, submitMemberApplication } from "@/lib/firebase";

export const Route = createFileRoute("/_authenticated/dashboard/applications")({
  head: () => ({
    meta: [
      { title: "Applications — Member Dashboard — Free City Organization" },
      { name: "description", content: "Submit and track your Free City character applications." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ApplicationsPage,
});

function statusBadgeClasses(status: "pending" | "approved" | "rejected") {
  switch (status) {
    case "approved":
      return "border-electric/40 bg-electric/15 text-electric";
    case "rejected":
      return "border-destructive/40 bg-destructive/15 text-destructive";
    default:
      return "border-glass-border bg-white/5 text-muted-foreground";
  }
}

function ApplicationsPage() {
  const { user } = Route.useRouteContext();
  const queryClient = useQueryClient();

  const [characterName, setCharacterName] = useState("");
  const [discordHandle, setDiscordHandle] = useState("");
  const [backstory, setBackstory] = useState("");
  const [submittingApp, setSubmittingApp] = useState(false);

  const applicationsQuery = useQuery({
    queryKey: ["applications", user.uid],
    queryFn: () => fetchMemberApplications(user.uid),
  });

  async function handleApplicationSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmittingApp(true);
    try {
      await submitMemberApplication(user.uid, {
        characterName,
        discordHandle,
        backstory,
      });
      setCharacterName("");
      setDiscordHandle("");
      setBackstory("");
      toast.success("Application submitted to Free City.");
      await queryClient.invalidateQueries({ queryKey: ["applications", user.uid] });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit your application. Please try again.");
    } finally {
      setSubmittingApp(false);
    }
  }

  return (
    <section className="space-y-8 pb-10">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.4em] text-electric">Whitelist &amp; Characters</p>
        <h1 className="hero-title mt-2 font-display text-4xl font-black uppercase leading-[0.95] md:text-5xl">
          Applications
        </h1>
      </div>

      <div className="animate-fade-up glass rounded-3xl p-6 md:p-8">
        <h2 className="flex items-center gap-3 font-display text-2xl font-extrabold uppercase tracking-wide">
          <FileText className="h-6 w-6 text-electric" /> Character Application
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Submit your Free City character concept for community review. Only you and Free City administrators can view your applications.
        </p>

        <form onSubmit={handleApplicationSubmit} className="mt-6 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="characterName">Character name</Label>
              <Input
                id="characterName"
                value={characterName}
                onChange={(e) => setCharacterName(e.target.value)}
                placeholder="e.g. Elena Vance"
                minLength={2}
                maxLength={80}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="discordHandle">Discord handle</Label>
              <Input
                id="discordHandle"
                value={discordHandle}
                onChange={(e) => setDiscordHandle(e.target.value)}
                placeholder="e.g. elenavance"
                minLength={2}
                maxLength={80}
                required
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="backstory">Character backstory</Label>
            <Textarea
              id="backstory"
              value={backstory}
              onChange={(e) => setBackstory(e.target.value)}
              placeholder="Tell us who your character is, their ambitions, and how they arrived in Free City..."
              minLength={20}
              maxLength={2000}
              rows={4}
              required
            />
          </div>
          <Button type="submit" variant="neon" size="xl" className="w-full sm:w-auto" disabled={submittingApp}>
            <Send className="h-4 w-4" />
            {submittingApp ? "Submitting…" : "Submit application"}
          </Button>
        </form>

        <div className="mt-8 border-t border-glass-border pt-6">
          <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">Your submitted applications</h3>
          {applicationsQuery.isPending ? (
            <div className="mt-4 h-20 animate-pulse rounded-2xl border border-glass-border" />
          ) : applicationsQuery.isError ? (
            <p className="mt-3 text-sm text-muted-foreground">Couldn't load your applications right now.</p>
          ) : !applicationsQuery.data || applicationsQuery.data.length === 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">You haven't submitted a character application yet.</p>
          ) : (
            <ul className="mt-4 space-y-3">
              {applicationsQuery.data.map((app) => (
                <li key={app.id} className="rounded-2xl border border-glass-border p-5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-foreground">{app.characterName}</p>
                      <p className="text-xs text-muted-foreground">
                        Discord: {app.discordHandle} · Submitted {formatFirestoreDate(app.createdAt)}
                      </p>
                    </div>
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wider ${statusBadgeClasses(app.status)}`}
                    >
                      {app.status}
                    </span>
                  </div>
                  <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{app.backstory}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
