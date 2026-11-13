import { Crown, Users, BarChart3, Sliders, KeyRound, Database, ScrollText } from "lucide-react";
import type { PortalNav } from "./types";

export const SUPER_ADMIN_NAV: PortalNav = {
  tabs: [
    { to: "/super-admin/dashboard", label: "Overview", icon: Crown },
    { to: "/super-admin/access", label: "Access", icon: Users },
    { to: "/super-admin/analytics", label: "Revenue", icon: BarChart3 },
    { to: "/super-admin/settings", label: "Settings", icon: Sliders },
  ],
  more: [
    {
      label: "Platform",
      items: [
        { to: "/super-admin/integrations", label: "API Keys", icon: KeyRound },
        { to: "/super-admin/health", label: "Database", icon: Database },
        { to: "/super-admin/audit", label: "Security Log", icon: ScrollText },
      ],
    },
  ],
};
