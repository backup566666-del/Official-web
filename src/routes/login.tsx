import { createFileRoute, useNavigate, useRouter } from "@tanstack/react-router";
import { onAuthStateChanged, signInWithPopup } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth, googleProvider, syncUserProfile } from "@/lib/firebase";
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

function formatAuthError(err: unknown): string {
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code: unknown }).code);
    switch (code) {
      case "auth/popup-closed-by-user":
      case "auth/cancelled-popup-request":
        return "Google sign-in was cancelled. Please try again.";
      case "auth/popup-blocked":
        return "Your browser blocked the Google sign-in popup. Please allow popups for this site and try again.";
      case "auth/unauthorized-domain":
        return "This domain is not authorized in Firebase Authentication yet. Add it under Firebase Console → Authentication → Settings → Authorized domains.";
      case "auth/network-request-failed":
        return "Network error while contacting Google sign-in. Please check your connection and try again.";
      default:
        break;
    }
  }
  return "Google sign-in didn't complete. Please try again.";
}

function LoginPage() {
  const navigate = useNavigate();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Already signed in: go straight to the member dashboard.
  useEffect(() => {
    let active = true;

    void auth.authStateReady().then(() => {
      if (active && auth.currentUser) {
        navigate({ to: "/dashboard", replace: true });
      }
    });

    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (active && firebaseUser) {
        navigate({ to: "/dashboard", replace: true });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [navigate]);

  async function handleGoogle() {
    setError(null);
    setBusy(true);
    try {
      const credential = await signInWithPopup(auth, googleProvider);
      await syncUserProfile(credential.user);
      await router.invalidate();
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      setError(formatAuthError(err));
      setBusy(false);
    }
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
          {busy ? "Signing in with Google…" : "Continue with Google"}
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
