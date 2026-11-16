import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { auth } from "@/lib/firebase";

// Members-only area. Client-side gate backed by Firebase Authentication; Firestore security
// rules independently enforce per-member authorization on all database reads and writes.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    await auth.authStateReady();
    if (!auth.currentUser) {
      throw redirect({ to: "/login" });
    }
    return { user: auth.currentUser };
  },
  component: () => <Outlet />,
});
