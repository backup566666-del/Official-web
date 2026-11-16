import { createFileRoute, Outlet } from "@tanstack/react-router";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: DashboardLayout,
});

function DashboardLayout() {
  const { user } = Route.useRouteContext();
  return (
    <DashboardShell user={user}>
      <Outlet />
    </DashboardShell>
  );
}
