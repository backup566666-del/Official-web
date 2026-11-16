import { useState } from "react";
import city from "@/assets/city-night.jpg";
import memberSunsetCityBg from "@/assets/images/member_sunset_city_bg_1794835966438.jpg";
import { useSessionUser } from "@/hooks/use-session-user";

/**
 * Fixed backdrop shared across the app.
 * - Logged-out visitors always see the original public night-city scene.
 * - Signed-in Firebase members automatically see the Free City sunset cityscape gaming scene.
 */
export function CityBackground() {
  const { user } = useSessionUser();
  const [memberImgFailed, setMemberImgFailed] = useState(false);
  const isLoggedIn = Boolean(user);

  if (isLoggedIn) {
    return (
      <div
        aria-hidden
        data-background-mode="member"
        className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-[#07050f]"
      >
        {!memberImgFailed ? (
          <img
            src={memberSunsetCityBg}
            alt=""
            width={1920}
            height={1080}
            referrerPolicy="no-referrer"
            onError={() => setMemberImgFailed(true)}
            className="animate-slow-zoom absolute inset-0 h-full w-full object-cover object-center opacity-80 transition-opacity duration-500"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_oklch(0.24_0.12_315_/_0.65),_#07050f_72%)]" />
        )}
        <div className="animate-drift animate-neon-pulse absolute -left-1/4 top-1/4 h-[60vh] w-[60vw] rounded-full bg-neon/22 blur-[130px]" />
        <div className="animate-drift absolute -right-1/4 bottom-0 h-[52vh] w-[52vw] rounded-full bg-neon-pink/18 blur-[130px]" />
        <div className="vignette absolute inset-0" />
        <div className="absolute inset-0 bg-[#07050f]/58" />
      </div>
    );
  }

  return (
    <div
      aria-hidden
      data-background-mode="public"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden bg-background"
    >
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
