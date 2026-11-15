import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowDown, Compass, MapPinned, UserRound, Users } from "lucide-react";
import characters from "@/assets/characters.webp";
import supercar from "@/assets/supercar.webp";
import { Button } from "@/components/ui/button";
import { DiscordButton } from "@/components/site/DiscordButton";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Free City Organization — Your City. Your Story." },
      {
        name: "description",
        content:
          "Enter the world of Free City Roleplay. Build your character, discover the city, meet people and create your own story.",
      },
      { property: "og:title", content: "Free City Organization — Your City. Your Story." },
      {
        property: "og:description",
        content: "An open-world RPG roleplay community. Build your character and create your own story.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

const PILLARS = [
  { icon: UserRound, title: "Build your character", text: "Shape who you are — your look, your past and the path you choose." },
  { icon: MapPinned, title: "Discover the city", text: "From neon-lit streets to quiet corners, the city is yours to explore." },
  { icon: Users, title: "Meet people", text: "Cross paths with other players and build connections that matter." },
  { icon: Compass, title: "Create your story", text: "Every choice writes the next chapter. No script, just your story." },
];

const STEPS = [
  { title: "Join the Discord", text: "Our community hub for updates and conversation." },
  { title: "Read the server rules", text: "Know the standards that keep the city fair for everyone." },
  { title: "Create your character", text: "Step into Free City and begin your story." },
];

function Home() {
  return (
    <>
      <Hero />
      <Pillars />
      <GetStarted />
      <FinalCta />
    </>
  );
}

function Hero() {
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden lg:block">
      {/* Text */}
      <div className="relative z-20 mx-auto w-full max-w-4xl px-5 pt-24 text-center md:pt-36 lg:pt-32 xl:pt-36">
        <p className="animate-fade-up text-[11px] font-bold uppercase tracking-[0.45em] text-electric md:text-xs">
          Free City Roleplay
        </p>
        <h1
          className="animate-fade-up hero-title mt-3 font-display text-[3.4rem] font-black uppercase leading-[0.85] tracking-tight sm:text-7xl md:text-8xl xl:text-[7.5rem]"
          style={{ animationDelay: "120ms" }}
        >
          Free City
          <span className="block text-gradient-neon">Organization</span>
        </h1>
        <p
          className="animate-fade-up mt-5 font-display text-xl font-bold uppercase tracking-[0.35em] text-foreground md:text-2xl"
          style={{ animationDelay: "240ms" }}
        >
          Your city. Your story.
        </p>
        <p
          className="animate-fade-up text-shadow-soft mx-auto mt-4 max-w-xl text-sm leading-relaxed text-muted-foreground md:text-base"
          style={{ animationDelay: "340ms" }}
        >
          Enter the world of Free City Roleplay. Build your character, discover the city, meet
          people and create your own story.
        </p>
        <div
          className="animate-fade-up mt-6 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center"
          style={{ animationDelay: "440ms" }}
        >
          <DiscordButton>Join our Discord</DiscordButton>
          <Button asChild variant="glass" size="xl">
            <a href="#explore">Explore Free City</a>
          </Button>
        </div>
      </div>

      {/* Scene: characters on one side, supercar on the other */}
      <div className="pointer-events-none relative z-10 mt-2 min-h-[300px] flex-1 sm:min-h-[420px] lg:absolute lg:inset-0 lg:mt-0">
        <div className="animate-neon-pulse absolute bottom-[10%] left-[5%] h-1/2 w-1/3 rounded-full bg-neon/25 blur-[90px]" />
        <div className="absolute bottom-[8%] right-[5%] h-1/3 w-1/3 rounded-full bg-electric/20 blur-[90px]" />

        <div className="ground-shadow absolute bottom-[2%] left-[-4%] h-16 w-[62%] lg:left-[0%] lg:w-[34%]" />
        <img
          src={characters}
          alt="A man and a woman roleplay character standing together in the city at night"
          width={755}
          height={1252}
          className="animate-slide-left subject-characters absolute bottom-[3%] left-[-2%] h-[96%] w-auto max-w-none sm:left-[4%] lg:bottom-[4%] lg:left-[2%] lg:h-[70%] xl:left-[4%]"
          style={{ animationDelay: "300ms" }}
        />

        <div className="ground-shadow absolute bottom-[0%] right-[-6%] h-20 w-[78%] lg:right-[2%] lg:w-[46%]" />
        <img
          src={supercar}
          alt="A yellow luxury supercar with its doors raised"
          width={1435}
          height={733}
          className="animate-slide-right subject-car absolute bottom-[2%] right-[-14%] w-[82%] max-w-none sm:right-[-4%] sm:w-[62%] lg:bottom-[5%] lg:right-[2%] lg:w-[44%] xl:right-[4%] xl:w-[42%]"
          style={{ animationDelay: "500ms" }}
        />
      </div>

      <div className="fade-bottom pointer-events-none absolute inset-x-0 bottom-0 z-10 h-28" />
      <a
        href="#explore"
        aria-label="Scroll to explore"
        className="absolute bottom-5 left-1/2 z-20 hidden -translate-x-1/2 text-muted-foreground transition-colors hover:text-foreground lg:block"
      >
        <ArrowDown className="h-5 w-5 animate-bounce" />
      </a>
    </section>
  );
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] font-bold uppercase tracking-[0.4em] text-electric md:text-xs">{eyebrow}</p>
      <h2 className="hero-title mt-3 font-display text-4xl font-black uppercase leading-[0.9] md:text-6xl">
        {title}
      </h2>
    </div>
  );
}

function Pillars() {
  return (
    <section id="explore" className="mx-auto max-w-7xl scroll-mt-20 px-5 py-24 md:px-8 md:py-32">
      <SectionHeading eyebrow="Explore Free City" title="One city. Endless stories." />
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PILLARS.map(({ icon: Icon, title, text }) => (
          <article
            key={title}
            className="glass group rounded-2xl p-6 transition-all duration-500 hover:-translate-y-1 hover:border-neon/50 hover:shadow-neon"
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-xl border border-glass-border text-electric transition-colors group-hover:text-neon">
              <Icon className="h-5 w-5" />
            </span>
            <h3 className="mt-6 font-display text-2xl font-extrabold uppercase tracking-wide">{title}</h3>
            <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}

function GetStarted() {
  return (
    <section className="mx-auto max-w-7xl px-5 pb-24 md:px-8 md:pb-32">
      <div className="glass grid gap-10 rounded-3xl p-6 md:p-12 lg:grid-cols-[1fr_1.4fr] lg:items-center">
        <SectionHeading eyebrow="Getting started" title="Your first steps in the city." />
        <ol className="grid gap-3">
          {STEPS.map((s, i) => (
            <li
              key={s.title}
              className="flex items-start gap-5 rounded-2xl border border-glass-border p-5 transition-colors hover:border-electric/50"
            >
              <span className="font-display text-4xl font-black leading-none text-gradient-neon">
                0{i + 1}
              </span>
              <div>
                <h3 className="font-display text-xl font-extrabold uppercase tracking-wide">{s.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{s.text}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function FinalCta() {
  return (
    <section className="relative px-5 pb-28 md:px-8 md:pb-36">
      <div className="mx-auto max-w-3xl text-center">
        <h2 className="hero-title font-display text-5xl font-black uppercase leading-[0.88] md:text-7xl">
          The city is <span className="text-gradient-neon">waiting.</span>
        </h2>
        <p className="mx-auto mt-5 max-w-md text-muted-foreground">
          Join the community and be part of Free City from the start.
        </p>
        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <DiscordButton>Join our Discord</DiscordButton>
          <Button asChild variant="glass" size="xl">
            <Link to="/rules">Read the rules</Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
