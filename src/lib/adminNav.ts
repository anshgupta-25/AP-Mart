import {
  LayoutDashboard, ClipboardList, Route as RouteIcon, Wallet, Store, MapPin, Users, UserPlus,
  Truck, BarChart, MessageSquareWarning, Bell, Settings, Package, Tag, Megaphone, Ticket,
  AlertTriangle, LifeBuoy, TrendingUp, IndianRupee,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface AdminNavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

export interface AdminNavGroup {
  label: string;
  items: AdminNavItem[];
}

/** Single source of truth for Admin navigation (desktop sidebar + mobile drawer). */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Overview",
    items: [{ to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard }],
  },
  {
    label: "Operations",
    items: [
      { to: "/admin/orders", label: "Orders", icon: ClipboardList },
      { to: "/admin/routing", label: "Routing", icon: RouteIcon },
      { to: "/admin/shops", label: "Shops", icon: Store },
      { to: "/admin/locations", label: "Locations", icon: MapPin },
      { to: "/admin/delivery-partners", label: "Partners", icon: Truck },
      { to: "/admin/delivery-pricing", label: "Delivery pricing", icon: IndianRupee },
    ],
  },
  {
    label: "Commerce",
    items: [
      { to: "/admin/products", label: "Products", icon: Package },
      { to: "/admin/categories", label: "Categories", icon: Tag },
      { to: "/admin/offers", label: "Offers", icon: Megaphone },
      { to: "/admin/coupons", label: "Coupons", icon: Ticket },
      { to: "/admin/products?filter=low-stock", label: "Stock Alerts", icon: AlertTriangle },
      { to: "/admin/payments", label: "Payments", icon: Wallet },
      { to: "/admin/earnings", label: "Earnings", icon: TrendingUp },
    ],
  },
  {
    label: "Users & Access",
    items: [
      { to: "/admin/customers", label: "Users", icon: Users },
      { to: "/admin/role-requests", label: "Role requests", icon: UserPlus },
    ],
  },
  {
    label: "Reporting & Support",
    items: [
      { to: "/admin/reports", label: "Reports", icon: BarChart },
      { to: "/admin/complaints", label: "Complaints", icon: MessageSquareWarning },
      { to: "/admin/support", label: "Support", icon: LifeBuoy },
      { to: "/admin/notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "System",
    items: [{ to: "/admin/settings", label: "Settings", icon: Settings }],
  },
];

/** Flat list derived from the grouped config — used by the desktop sidebar. */
export const ADMIN_NAV: AdminNavItem[] = ADMIN_NAV_GROUPS.flatMap((g) => g.items);

export function isAdminNavActive(pathname: string, to: string) {
  const base = to.split("?")[0];
  return pathname === base || pathname.startsWith(base + "/");
}
