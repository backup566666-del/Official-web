import { onAuthStateChanged, type User } from "firebase/auth";
import { useEffect, useState } from "react";
import { auth } from "@/lib/firebase";

export type SessionUser = User;

/** Current signed-in Firebase user for UI affordances (header links, admin controls). Not a security check. */
export function useSessionUser() {
  const [user, setUser] = useState<SessionUser | null>(() => auth.currentUser);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setReady(true);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  return { user, ready };
}
