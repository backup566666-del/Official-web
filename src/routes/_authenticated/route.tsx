import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { getGoogleSessionUser } from "@/lib/google-auth";

// Members-only area. Checks Supabase session first, then server-signed Google OAuth session.
export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (!error && data.user) {
      return { user: data.user };
    }
    const googleUser = await getGoogleSessionUser();
    if (googleUser) {
      return { user: googleUser };
    }
    throw redirect({ to: "/login" });
  },
  component: () => <Outlet />,
});
