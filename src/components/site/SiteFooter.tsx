import { Link } from "@tanstack/react-router";
import { NAV_LINKS } from "@/lib/site-links";
import { useSessionUser } from "@/hooks/use-session-user";

export function SiteFooter() {
  const { user } = useSessionUser();
  const account = user
    ? ({ to: "/dashboard", label: "Dashboard" } as const)
    : ({ to: "/login", label: "Login" } as const);
  return (
    <footer className="glass border-x-0 border-b-0">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 md:flex-row md:items-center md:justify-between md:px-8">
        <div>
          <p className="font-display text-xl font-extrabold uppercase tracking-[0.3em]">
            Free City Organization
          </p>
          <p className="mt-2 text-sm text-muted-foreground">Your city. Your story.</p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-3" aria-label="Footer">
          {[...NAV_LINKS, account].map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className="text-sm font-semibold uppercase tracking-[0.14em] text-muted-foreground transition-colors hover:text-foreground"
            >
              {l.label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="border-t border-glass-border">
        <p className="mx-auto max-w-7xl px-5 py-5 text-xs text-muted-foreground md:px-8">
          © {new Date().getFullYear()} Free City Organization. A fan-made roleplay community.
        </p>
      </div>
    </footer>
  );
}
