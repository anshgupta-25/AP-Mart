import { LayoutDashboard, Inbox, User } from "lucide-react";
import type { PortalNav } from "./types";

export const SUPPORT_NAV: PortalNav = {
  tabs: [
    { to: "/support/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/support/tickets", label: "Tickets", icon: Inbox },
    { to: "/support/profile", label: "Profile", icon: User },
  ],
};
