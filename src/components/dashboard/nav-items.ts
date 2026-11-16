import {
  Banknote,
  CalendarDays,
  Coins,
  Crown,
  FileText,
  Gamepad2,
  Home,
  LifeBuoy,
  ScrollText,
  Settings,
  UserRound,
  type LucideIcon,
} from "lucide-react";

export type DashboardNavItem = {
  to:
    | "/dashboard"
    | "/dashboard/profile"
    | "/dashboard/rules"
    | "/dashboard/vip"
    | "/dashboard/applications"
    | "/dashboard/game"
    | "/dashboard/top-up"
    | "/dashboard/cash-top-up"
    | "/dashboard/events"
    | "/dashboard/settings"
    | "/dashboard/support";
  label: string;
  icon: LucideIcon;
};

export const DASHBOARD_NAV_ITEMS: readonly DashboardNavItem[] = [
  { to: "/dashboard", label: "Home", icon: Home },
  { to: "/dashboard/profile", label: "My Profile", icon: UserRound },
  { to: "/dashboard/rules", label: "Server Rules", icon: ScrollText },
  { to: "/dashboard/vip", label: "VIP Membership", icon: Crown },
  { to: "/dashboard/applications", label: "Applications", icon: FileText },
  { to: "/dashboard/game", label: "Game Website & Installation", icon: Gamepad2 },
  { to: "/dashboard/top-up", label: "Game Top-up", icon: Coins },
  { to: "/dashboard/cash-top-up", label: "Cash Top-up", icon: Banknote },
  { to: "/dashboard/events", label: "Events", icon: CalendarDays },
  { to: "/dashboard/settings", label: "Settings", icon: Settings },
  { to: "/dashboard/support", label: "Support", icon: LifeBuoy },
];
