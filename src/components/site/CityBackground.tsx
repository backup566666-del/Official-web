import city from "@/assets/city-night.jpg";

/** Fixed night-city backdrop shared by every page. Uses a fixed layer (not background-attachment) so it stays put on Android/iOS. */
export function CityBackground() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background">
      <img
        src={city}
        alt=""
        width={1920}
        height={1088}
        className="animate-slow-zoom absolute inset-0 h-full w-full object-cover object-[50%_60%] opacity-90"
      />
      <div className="animate-drift absolute -left-1/4 top-1/4 h-[60vh] w-[60vw] rounded-full bg-neon/15 blur-[120px] animate-neon-pulse" />
      <div className="animate-drift absolute -right-1/4 top-0 h-[50vh] w-[50vw] rounded-full bg-electric/15 blur-[120px]" />
      <div className="vignette absolute inset-0" />
      <div className="absolute inset-0 bg-background/35" />
    </div>
  );
}
