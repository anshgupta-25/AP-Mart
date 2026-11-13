import { LayoutDashboard, ClipboardList, Package, Truck, Wallet, Megaphone, Ticket, Bell, BarChart3, Star, Settings, LifeBuoy } from "lucide-react";
import type { PortalNav } from "./types";

export const SHOPKEEPER_NAV: PortalNav = {
  tabs: [
    { to: "/shopkeeper/dashboard", label: "Home", icon: LayoutDashboard },
    { to: "/shopkeeper/orders", label: "Orders", icon: ClipboardList },
    { to: "/shopkeeper/products", label: "Products", icon: Package },
    { to: "/shopkeeper/delivery", label: "Delivery", icon: Truck },
  ],
  more: [
    {
      label: "Manage",
      items: [
        { to: "/shopkeeper/earnings", label: "Earnings", icon: Wallet },
        { to: "/shopkeeper/offers", label: "Offers", icon: Megaphone },
        { to: "/shopkeeper/coupons", label: "Coupons", icon: Ticket },
        { to: "/shopkeeper/inventory-insights", label: "Inventory insights", icon: BarChart3 },
        { to: "/shopkeeper/notifications", label: "Alerts", icon: Bell },
        { to: "/shopkeeper/reviews", label: "Reviews", icon: Star },
      ],
    },
    {
      label: "Account",
      items: [
        { to: "/shopkeeper/settings", label: "Settings", icon: Settings },
        { to: "/support/my-tickets", label: "Help & Support", icon: LifeBuoy },
      ],
    },
  ],
};
