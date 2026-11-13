import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell, ChevronDown, Heart, LayoutGrid, MapPin } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
import { LogoMark } from "@/components/Logo";
import { SearchButton } from "@/components/shell/SearchSheet";
import { cn } from "@/lib/utils";

type Cat = { id: string; slug: string; name: string; icon: string | null };

const DESKTOP_LINKS = [
  { to: "/", label: "Home", authTo: "/customer/home" },
  { to: "/products", label: "Browse", authTo: "/customer/categories" },
  { to: "/orders", label: "Orders", authTo: "/customer/orders" },
] as const;

/**
 * Storefront top bar (public and customer). Search is an icon that opens the SearchSheet.
 * With `tabs`, the sticky category-tab row is rendered below the bar (storefront home only).
 */
export function CustomerHeader({ tabs = false, pathname = "" }: { tabs?: boolean; pathname?: string }) {
  const { user } = useAuth();
  const { totalQty } = useCart();
  const { addressLabel } = useDeliveryContext();
  const initials = (user?.email ?? "U").slice(0, 1).toUpperCase();

  const cats = useQuery({
    queryKey: ["header-categories"],
    staleTime: 5 * 60_000,
    enabled: tabs,
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, slug, name, icon").eq("is_active", true).order("display_order").limit(12);
      return (data ?? []) as Cat[];
    },
  });

  return (
    <header className="hairline-b sticky top-0 z-40 bg-tint-mint pt-safe">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-2 px-4 md:px-6">
        <Link to={user ? "/customer/home" : "/"} aria-label="AP Mart home" className="shrink-0">
          <LogoMark size="xs" className="h-8 w-8 rounded-full" />
        </Link>

        <Link to={user ? "/customer/profile" : "/login"} className="min-w-0 flex-1 leading-tight">
          <span className="block text-micro font-medium text-muted-foreground">Deliver to</span>
          <span className="flex items-center gap-0.5 text-meta font-semibold">
            <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" />
            <span className="truncate">{user ? (addressLabel ?? "Choose your address") : "Select your location"}</span>
            <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
          </span>
        </Link>

        <nav className="mr-2 hidden items-center gap-1 md:flex" aria-label="Primary">
          {DESKTOP_LINKS.map((l) => {
            const to = user ? l.authTo : l.to;
            const active = pathname === to || (to !== "/" && pathname.startsWith(to));
            return (
              <Link key={l.label} to={to as any} className={cn("rounded-lg px-3 py-1.5 text-body font-medium", active ? "bg-card text-primary" : "text-foreground/75 hover:bg-card/70")}>
                {l.label}
              </Link>
            );
          })}
          <Link to="/customer/cart" className="relative rounded-lg px-3 py-1.5 text-body font-medium text-foreground/75 hover:bg-card/70">
            Cart
            {totalQty > 0 && <span className="ml-1.5 rounded-full bg-primary px-1.5 text-micro font-bold text-primary-foreground">{totalQty}</span>}
          </Link>
        </nav>

        <SearchButton />
        <Link to={user ? "/customer/wishlist" : "/favourites"} aria-label="Saved items" className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card shadow-soft">
          <Heart className="h-4 w-4" />
        </Link>
        {user ? (
          <>
            <Link to="/customer/notifications" aria-label="Notifications" className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card shadow-soft">
              <Bell className="h-4 w-4" />
            </Link>
            <Link to="/customer/profile" aria-label="Profile" className="press grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary text-small font-semibold text-primary-foreground">
              {initials}
            </Link>
          </>
        ) : (
          <Link to="/login" className="press inline-flex h-9 shrink-0 items-center rounded-full bg-primary px-4 text-meta font-semibold text-primary-foreground">
            Login
          </Link>
        )}
      </div>

      {tabs && (
        <nav className="scrollbar-hide mx-auto flex max-w-6xl overflow-x-auto px-2" aria-label="Categories">
          <span className="relative flex w-16 shrink-0 flex-col items-center gap-0.5 px-1 pb-1.5 pt-0.5 text-foreground">
            <LayoutGrid className="h-5 w-5" />
            <span className="text-micro font-semibold">All</span>
            <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-foreground" />
          </span>
          {(cats.data ?? []).map((c) => (
            <Link key={c.id} to="/category/$slug" params={{ slug: c.slug }} className="press flex w-[68px] shrink-0 flex-col items-center gap-0.5 px-1 pb-1.5 pt-0.5 text-muted-foreground">
              <span className="text-subtitle leading-5">{c.icon ?? "•"}</span>
              <span className="w-full truncate text-center text-micro font-medium">{c.name}</span>
            </Link>
          ))}
        </nav>
      )}
    </header>
  );
}
