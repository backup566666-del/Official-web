import type { ReactNode } from "react";

export function PageIntro({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <section className="mx-auto max-w-4xl px-5 pb-24 pt-32 md:px-8 md:pt-44">
      <p className="animate-fade-up text-xs font-bold uppercase tracking-[0.4em] text-electric">
        {eyebrow}
      </p>
      <h1
        className="animate-fade-up hero-title mt-4 font-display text-5xl font-black uppercase leading-[0.9] md:text-7xl"
        style={{ animationDelay: "100ms" }}
      >
        {title}
      </h1>
      <div className="animate-fade-up mt-10" style={{ animationDelay: "200ms" }}>
        {children}
      </div>
    </section>
  );
}

export function ComingSoonPanel({ text }: { text: string }) {
  return (
    <div className="glass rounded-2xl p-6 md:p-10">
      <span className="inline-flex items-center gap-2 rounded-full border border-neon/40 px-3 py-1 text-[11px] font-bold uppercase tracking-[0.25em] text-neon">
        <span className="h-1.5 w-1.5 rounded-full bg-neon animate-neon-pulse" />
        Coming soon
      </span>
      <p className="mt-5 text-base leading-relaxed text-muted-foreground md:text-lg">{text}</p>
    </div>
  );
}
