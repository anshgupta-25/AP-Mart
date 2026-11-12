import { Link, useRouterState } from "@tanstack/react-router";
import { Home, LayoutGrid, ShoppingCart, Heart, Package } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { cn } from "@/lib/utils";

const items: Array<{ to: "/" | "/products" | "/cart" | "/favourites" | "/orders"; label: string; icon: typeof Home; badge?: boolean }> = [
  { to: "/", label: "Home", icon: Home },
  { to: "/products", label: "Category", icon: LayoutGrid },
  { to: "/cart", label: "Cart", icon: ShoppingCart, badge: true },
  { to: "/favourites", label: "Favourite", icon: Heart },
  { to: "/orders", label: "My Orders", icon: Package },
];

export function BottomNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { totalQty } = useCart();

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <ul className="mx-auto flex max-w-7xl items-stretch justify-between px-2">
        {items.map(({ to, label, icon: Icon, badge }) => {
          const active = to === "/" ? pathname === "/" : pathname.startsWith(to);
          return (
            <li key={to} className="flex-1">
              <Link
                to={to}
                className={cn(
                  "flex flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
                  active ? "text-primary" : "text-muted-foreground"
                )}
              >
                <span className="relative">
                  <Icon className={cn("h-5 w-5", active && "stroke-[2.5]")} />
                  {badge && totalQty > 0 && (
                    <span className="absolute -top-1.5 -right-2 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                      {totalQty}
                    </span>
                  )}
                </span>
                <span>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
