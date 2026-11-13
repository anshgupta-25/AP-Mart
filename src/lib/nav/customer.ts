import { Home, LayoutGrid, ShoppingCart, Package, User } from "lucide-react";
import type { PortalNav } from "./types";

export const CUSTOMER_NAV: PortalNav = {
  tabs: [
    { to: "/customer/home", label: "Home", icon: Home },
    { to: "/customer/categories", label: "Categories", icon: LayoutGrid },
    { to: "/customer/orders", label: "Orders", icon: Package },
    { to: "/customer/cart", label: "Cart", icon: ShoppingCart, badge: "cart" },
    { to: "/customer/profile", label: "Profile", icon: User },
  ],
};

/** Public (logged-out) storefront tabs: same layout, public paths where they exist. */
export const PUBLIC_NAV: PortalNav = {
  tabs: [
    { to: "/", label: "Home", icon: Home },
    { to: "/products", label: "Categories", icon: LayoutGrid },
    { to: "/orders", label: "Orders", icon: Package },
    { to: "/customer/cart", label: "Cart", icon: ShoppingCart, badge: "cart" },
    { to: "/account", label: "Profile", icon: User },
  ],
};
