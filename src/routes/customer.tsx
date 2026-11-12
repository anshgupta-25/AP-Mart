import { createFileRoute, Link, Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Home, LayoutGrid, ShoppingCart, Package, User } from "lucide-react";
import { motion } from "framer-motion";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { cn } from "@/lib/utils";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { FloatingCartBar } from "@/components/customer/FloatingCartBar";
import { useCustomerCatalogRealtime } from "@/hooks/useCustomerProducts";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";

export const Route = createFileRoute("/customer")({
  head: () => ({ meta: [{ title: "AP Mart — 10-min grocery delivery" }] }),
  component: CustomerShell,
});

const NAV = [
  { to: "/customer/home", label: "Home", icon: Home },
  { to: "/customer/categories", label: "Categories", icon: LayoutGrid },
  { to: "/customer/cart", label: "Cart", icon: ShoppingCart, badge: true as const },
  { to: "/customer/orders", label: "Orders", icon: Package },
  { to: "/customer/profile", label: "Profile", icon: User },
] as const;

function CustomerShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, roles } = useAuth() as any;
  const navigate = useNavigate();
  const { totalQty } = useCart();
  const { hasAddress, ready: addressReady } = useDeliveryContext();
  useCustomerCatalogRealtime();

  const onSetup = pathname.startsWith("/customer/address-setup");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { next: pathname } as never, replace: true });
      return;
    }
    const r: string[] = roles ?? [];
    if (r.includes("shopkeeper")) navigate({ to: "/shopkeeper/dashboard", replace: true });
    else if (r.includes("delivery")) navigate({ to: "/delivery/dashboard", replace: true });
  }, [user, loading, roles, navigate]);

  // Every customer must have a default delivery address before browsing —
  // this also covers accounts created by an admin via role assignment.
  useEffect(() => {
    if (loading || !user || onSetup) return;
    if (addressReady && !hasAddress) {
      navigate({
        to: "/customer/address-setup",
        search: { next: pathname } as never,
        replace: true,
      });
    }
  }, [loading, user, onSetup, addressReady, hasAddress, navigate, pathname]);

  if (pathname === "/customer") return <Navigate to="/customer/home" replace />;

  if (onSetup) return <Outlet />;

  const showHeader = pathname === "/customer/home";

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {showHeader && <CustomerHeader />}

      <main className="flex-1 min-w-0 pb-32">
        <Outlet />
      </main>

      {!/^\/customer\/(cart|checkout)/.test(pathname) && <FloatingCartBar />}

      {/* Floating bottom nav */}
      <nav className="fixed bottom-3 left-3 right-3 z-30">
        <div className="rounded-2xl glass shadow-float border border-border/60 grid grid-cols-5">
          {NAV.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-bold transition",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                {active && (
                  <motion.span
                    layoutId="navActive"
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-1 w-8 rounded-b-full bg-primary"
                    transition={{ type: "spring", stiffness: 400, damping: 28 }}
                  />
                )}
                <span className="relative">
                  <Icon className={cn("h-[22px] w-[22px] transition", active && "stroke-[2.5]")} />
                  {"badge" in n && n.badge && totalQty > 0 && (
                    <span className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-accent text-accent-foreground text-[9px] font-extrabold">
                      {totalQty}
                    </span>
                  )}
                </span>
                <span>{n.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
