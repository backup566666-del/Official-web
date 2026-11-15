// Client-safe Google OAuth session helpers (no secrets).

export type GoogleAuthUser = {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  account_created_at: string;
  provider: "google";
};

const TOKEN_STORAGE_KEY = "fc-google-session-token";
const listeners = new Set<(user: GoogleAuthUser | null) => void>();

function notify(user: GoogleAuthUser | null) {
  for (const fn of listeners) fn(user);
}

export function getStoredGoogleSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

export function setStoredGoogleSessionToken(token: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (token) window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
    else window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage restriction errors.
  }
}

export function onGoogleAuthChange(cb: (user: GoogleAuthUser | null) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export async function getGoogleAuthConfig(
  mode: "popup" | "redirect",
): Promise<{ configured: boolean; url?: string }> {
  const params = new URLSearchParams({
    origin: window.location.origin,
    mode,
  });
  const res = await fetch(`/api/auth/google/url?${params.toString()}`, {
    credentials: "include",
  });
  if (!res.ok) return { configured: false };
  return (await res.json()) as { configured: boolean; url?: string };
}

export async function getGoogleSessionUser(): Promise<GoogleAuthUser | null> {
  if (typeof window === "undefined") return null;
  try {
    const token = getStoredGoogleSessionToken();
    const res = await fetch("/api/auth/session", {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { user: GoogleAuthUser | null };
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function completeGooglePopupSession(token: string): Promise<GoogleAuthUser | null> {
  setStoredGoogleSessionToken(token);
  // Also ask server to set HttpOnly cookie in the iframe context when permitted.
  try {
    await fetch("/api/auth/session", {
      method: "POST",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ token }),
    });
  } catch {
    // Token in sessionStorage still authenticates API requests if third-party cookies are blocked.
  }
  const user = await getGoogleSessionUser();
  notify(user);
  return user;
}

export async function signOutGoogleSession(): Promise<void> {
  setStoredGoogleSessionToken(null);
  try {
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    });
  } catch {
    // Best-effort cookie clear.
  }
  notify(null);
}
