import { LayoutDashboard, ClipboardList, Store, Users } from "lucide-react";
import { ADMIN_NAV_GROUPS } from "@/lib/adminNav";
import type { PortalNav } from "./types";

/** Every one of the 21 admin destinations stays reachable: 4 tabs + "More" (all groups) + desktop sidebar (all groups). */
export const ADMIN_PORTAL_NAV: PortalNav = {
  tabs: [
    { to: "/admin/dashboard", label: "Home", icon: LayoutDashboard },
    { to: "/admin/orders", label: "Orders", icon: ClipboardList },
    { to: "/admin/shops", label: "Shops", icon: Store },
    { to: "/admin/customers", label: "Users", icon: Users },
  ],
  more: ADMIN_NAV_GROUPS,
  sidebar: ADMIN_NAV_GROUPS,
};
