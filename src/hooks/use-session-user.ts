import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { getGoogleSessionUser, onGoogleAuthChange, type GoogleAuthUser } from "@/lib/google-auth";

export type SessionUser = User | GoogleAuthUser;

/** Current signed-in user for UI affordances (header links). Not a security check. */
export function useSessionUser() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let active = true;
    Promise.all([
      supabase.auth.getUser().then(({ data }) => data.user ?? null).catch(() => null),
      getGoogleSessionUser(),
    ]).then(([supabaseUser, googleUser]) => {
      if (!active) return;
      setUser(supabaseUser ?? googleUser ?? null);
      setReady(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user);
        setReady(true);
      } else {
        getGoogleSessionUser().then((googleUser) => {
          if (!active) return;
          setUser(googleUser);
          setReady(true);
        });
      }
    });

    const unsubGoogle = onGoogleAuthChange((googleUser) => {
      if (!active) return;
      if (googleUser) {
        setUser(googleUser);
        setReady(true);
      } else {
        supabase.auth
          .getUser()
          .then(({ data }) => {
            if (!active) return;
            setUser(data.user ?? null);
            setReady(true);
          })
          .catch(() => {
            if (!active) return;
            setUser(null);
            setReady(true);
          });
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      unsubGoogle();
    };
  }, []);

  return { user, ready };
}
