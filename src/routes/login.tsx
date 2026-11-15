import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import {
  completeGooglePopupSession,
  getGoogleAuthConfig,
  getGoogleSessionUser,
} from "@/lib/google-auth";
import { GoogleButton } from "@/components/site/GoogleButton";
import { PageIntro } from "@/components/site/PageIntro";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Login — Free City Organization" },
      { name: "description", content: "Sign in to your Free City Organization member account with Google." },
      { property: "og:title", content: "Login — Free City Organization" },
      { property: "og:description", content: "Sign in to your Free City Organization member account with Google." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const popupTimerRef = useRef<number | null>(null);

  // Already signed in (or just returned from Google): go straight to the dashboard.
  useEffect(() => {
    let active = true;

    const params = new URLSearchParams(window.location.search);
    if (params.get("oauth_error")) {
      setError("Google sign-in didn't complete. Please try again.");
      window.history.replaceState(null, "", window.location.pathname);
    }

    Promise.all([
      supabase.auth.getUser().then(({ data }) => data.user ?? null).catch(() => null),
      getGoogleSessionUser(),
    ]).then(([supabaseUser, googleUser]) => {
      if (active && (supabaseUser || googleUser)) {
        navigate({ to: "/dashboard", replace: true });
      }
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" && session?.user) navigate({ to: "/dashboard", replace: true });
    });

    const onMessage = async (event: MessageEvent) => {
      const origin = event.origin;
      if (
        origin !== window.location.origin &&
        !origin.endsWith(".run.app") &&
        !origin.includes("localhost")
      ) {
        return;
      }
      if (event.data?.type === "FC_GOOGLE_AUTH_SUCCESS" && typeof event.data.sessionToken === "string") {
        if (popupTimerRef.current !== null) {
          window.clearInterval(popupTimerRef.current);
          popupTimerRef.current = null;
        }
        const user = await completeGooglePopupSession(event.data.sessionToken);
        if (user) {
          await router.invalidate();
          navigate({ to: "/dashboard", replace: true });
        } else {
          setBusy(false);
          setError("Could not verify your Google session. Please try again.");
        }
      } else if (event.data?.type === "FC_GOOGLE_AUTH_ERROR") {
        if (popupTimerRef.current !== null) {
          window.clearInterval(popupTimerRef.current);
          popupTimerRef.current = null;
        }
        setBusy(false);
        setError(typeof event.data.message === "string" ? event.data.message : "Google sign-in didn't complete. Please try again.");
      }
    };

    window.addEventListener("message", onMessage);

    return () => {
      active = false;
      if (popupTimerRef.current !== null) window.clearInterval(popupTimerRef.current);
      window.removeEventListener("message", onMessage);
      sub.subscription.unsubscribe();
    };
  }, [navigate, router]);

  async function handleGoogle() {
    setError(null);
    setBusy(true);

    const framed = window.self !== window.top;
    // Open a blank popup synchronously on user click when framed so popup blockers allow it.
    const popup = framed ? window.open("", "fc_google_oauth", "width=520,height=680") : null;

    try {
      const config = await getGoogleAuthConfig(framed ? "popup" : "redirect");
      if (config.configured && config.url) {
        if (framed) {
          if (!popup) {
            setBusy(false);
            setError("Please allow popups for this site to sign in with Google.");
            return;
          }
          popup.location.href = config.url;
          popupTimerRef.current = window.setInterval(() => {
            if (popup.closed) {
              if (popupTimerRef.current !== null) {
                window.clearInterval(popupTimerRef.current);
                popupTimerRef.current = null;
              }
              setBusy(false);
            }
          }, 400);
          return;
        }
        window.location.assign(config.url);
        return;
      }

      popup?.close();
    } catch {
      popup?.close();
    }

    // Fallback to existing Lovable Cloud / Supabase OAuth if configured.
    if (import.meta.env["VITE_SUPABASE_URL"]) {
      const result = await lovable.auth.signInWithOAuth("google", {
        redirect_uri: `${window.location.origin}/login`,
      });
      if (result.error) {
        setBusy(false);
        setError("Google sign-in didn't complete. Please try again.");
        return;
      }
      if (result.redirected) return;
      navigate({ to: "/dashboard", replace: true });
      return;
    }

    setBusy(false);
    setError("Google OAuth is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET on the server.");
  }

  return (
    <PageIntro eyebrow="Members" title="Login">
      <div className="glass max-w-md space-y-6 rounded-2xl p-6 md:p-8">
        <div>
          <h2 className="font-display text-2xl font-extrabold uppercase tracking-wide">Welcome to Free City</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
            Sign in with your Google account to open your member dashboard. New members get an
            account the first time they sign in.
          </p>
        </div>
        <GoogleButton onClick={handleGoogle} disabled={busy}>
          Continue with Google
        </GoogleButton>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
        <p className="text-xs leading-relaxed text-muted-foreground">
          We save your Google name, email and profile picture to your member profile.
        </p>
      </div>
    </PageIntro>
  );
}
