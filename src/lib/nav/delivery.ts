import { LayoutDashboard, PackageSearch, History, Wallet, User } from "lucide-react";
import type { PortalNav } from "./types";

export const DELIVERY_NAV: PortalNav = {
  tabs: [
    { to: "/delivery/dashboard", label: "Active", icon: LayoutDashboard },
    { to: "/delivery/available-orders", label: "Available", icon: PackageSearch },
    { to: "/delivery/history", label: "History", icon: History },
    { to: "/delivery/earnings", label: "Earnings", icon: Wallet },
    { to: "/delivery/profile", label: "Account", icon: User },
  ],
};
