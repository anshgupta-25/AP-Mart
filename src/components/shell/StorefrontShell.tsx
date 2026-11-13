import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { CustomerHeader } from "@/components/customer/CustomerHeader";
import { FloatingCartBar } from "@/components/customer/FloatingCartBar";
import { CUSTOMER_NAV, PUBLIC_NAV } from "@/lib/nav/customer";

/** Which tab is highlighted for a path (covers both the public and the /customer/* path families). */
function tabKey(pathname: string): string | null {
  if (pathname === "/" || pathname.startsWith("/customer/home")) return "Home";
  if (/^\/(customer\/categories|products|category|product)(\/|$)/.test(pathname))
    return "Categories";
  if (/^\/(customer\/orders|orders)(\/|$)/.test(pathname)) return "Orders";
  if (/^\/(customer\/cart|checkout)(\/|$)/.test(pathname)) return "Cart";
  if (
    /^\/(customer\/profile|account|customer\/wishlist|favourites|customer\/notifications)(\/|$)/.test(
      pathname,
    )
  )
    return "Profile";
  return null;
}

/** One chrome for every storefront screen (public and customer): top bar, optional category tabs, bottom tabs. */
export function StorefrontShell({
  children,
  hideTabs = false,
  footer,
}: {
  children: ReactNode;
  hideTabs?: boolean;
  footer?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user } = useAuth();
  const { totalQty } = useCart();
  const nav = user ? CUSTOMER_NAV : PUBLIC_NAV;
  const active = tabKey(pathname);
  const isHome = pathname === "/" || pathname === "/customer/home";
  // Product pages have their own fixed add-to-cart bar in the same spot (the Cart tab
  // still shows the count), so the floating cart bar would cover its +/- buttons.
  const showCartBar =
    !hideTabs && !/^\/(customer\/cart|checkout|product\/|customer\/product\/)/.test(pathname);

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <CustomerHeader tabs={isHome} pathname={pathname} />
      <main
        className={cn(
          "mx-auto w-full max-w-6xl min-w-0 flex-1",
          hideTabs ? "pb-8" : "pb-36 md:pb-10",
        )}
      >
        {children}
      </main>
      {footer}
      {showCartBar && <FloatingCartBar />}
      {!hideTabs && (
        <nav className="bar-blur hairline-t fixed inset-x-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] md:hidden">
          <div className="mx-auto grid max-w-2xl grid-cols-5">
            {nav.tabs.map((t) => {
              const Icon = t.icon;
              const on = active === t.label;
              const count = t.badge === "cart" ? totalQty : 0;
              return (
                <Link
                  key={t.label}
                  to={t.to as any}
                  className={cn(
                    "press relative flex flex-col items-center justify-center gap-0.5 pb-1.5 pt-2 text-micro font-semibold transition-colors",
                    on ? "text-foreground" : "text-muted-foreground",
                  )}
                >
                  {on && (
                    <span className="absolute inset-x-5 top-0 h-[3px] rounded-b-full bg-primary" />
                  )}
                  <span className="relative">
                    <Icon
                      className={cn("h-[22px] w-[22px]", on && "text-primary")}
                      strokeWidth={on ? 2.2 : 1.7}
                    />
                    {count > 0 && (
                      <span className="absolute -right-2 -top-1.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-micro font-bold text-primary-foreground">
                        {count}
                      </span>
                    )}
                  </span>
                  <span>{t.label}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
