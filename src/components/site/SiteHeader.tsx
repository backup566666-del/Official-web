import { Link } from "@tanstack/react-router";
import { Menu, X } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { NAV_LINKS } from "@/lib/site-links";
import { useSessionUser } from "@/hooks/use-session-user";

export function SiteHeader() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const { user } = useSessionUser();
  const account = user
    ? ({ to: "/dashboard", label: "Dashboard" } as const)
    : ({ to: "/login", label: "Login" } as const);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      className={cn(
        "fixed inset-x-0 top-0 z-50 transition-all duration-500",
        scrolled || open ? "glass-strong" : "border-b border-transparent",
      )}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-5 md:h-20 md:px-8">
        <Link
          to="/"
          onClick={() => setOpen(false)}
          className="font-display text-lg font-extrabold uppercase tracking-[0.3em] text-foreground md:text-xl"
        >
          Free City
        </Link>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Main">
          {NAV_LINKS.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              className="group relative px-4 py-2 text-sm font-semibold uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground data-[status=active]:text-foreground"
            >
              {l.label}
              <span className="absolute inset-x-4 -bottom-0.5 h-px origin-left scale-x-0 bg-gradient-neon transition-transform duration-300 group-hover:scale-x-100 group-data-[status=active]:scale-x-100" />
            </Link>
          ))}
          <Link
            to={account.to}
            className="ml-3 rounded-full border border-glass-border px-5 py-2 text-sm font-semibold uppercase tracking-[0.16em] text-foreground transition-all hover:border-neon/70 hover:shadow-neon"
          >
            {account.label}
          </Link>
        </nav>

        <button
          type="button"
          className="glass flex h-11 w-11 items-center justify-center rounded-full lg:hidden"
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {open && (
        <nav
          aria-label="Mobile"
          className="animate-fade-up flex h-[calc(100svh-4rem)] flex-col gap-1 px-5 pb-10 pt-4 lg:hidden"
        >
          {[...NAV_LINKS, account].map((l, i) => (
            <Link
              key={l.to}
              to={l.to}
              activeOptions={{ exact: true }}
              onClick={() => setOpen(false)}
              style={{ animationDelay: `${i * 50}ms` }}
              className="group animate-fade-up flex items-center justify-between border-b border-glass-border py-4 font-display text-3xl font-bold uppercase tracking-wide text-muted-foreground data-[status=active]:text-foreground"
            >
              {l.label}
              <span className="h-1.5 w-1.5 rounded-full bg-gradient-neon opacity-0 group-data-[status=active]:opacity-100" />
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
