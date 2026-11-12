import { createFileRoute, Link, Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, ClipboardList, Package, Wallet, User, Bell, Megaphone, Menu, Truck, Star, Settings, Ticket, LifeBuoy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { RoleHeader } from "@/components/RoleHeader";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { LogoMark } from "@/components/Logo";

export const Route = createFileRoute("/shopkeeper")({
  head: () => ({ meta: [{ title: "Shopkeeper — AP Mart" }] }),
  component: ShopkeeperShell,
});

const NAV = [
  { to: "/shopkeeper/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/shopkeeper/orders", label: "Orders", icon: ClipboardList },
  { to: "/shopkeeper/products", label: "Products", icon: Package },
  { to: "/shopkeeper/offers", label: "Offers", icon: Megaphone },
  { to: "/shopkeeper/earnings", label: "Earnings", icon: Wallet },
  { to: "/shopkeeper/settings", label: "Account", icon: User },
] as const;

const DRAWER_NAV = [
  { to: "/shopkeeper/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/shopkeeper/orders", label: "Orders", icon: ClipboardList },
  { to: "/shopkeeper/products", label: "Products", icon: Package },
  
  { to: "/shopkeeper/delivery", label: "Delivery", icon: Truck },
  { to: "/shopkeeper/offers", label: "Offers", icon: Megaphone },
  { to: "/shopkeeper/coupons", label: "Coupons", icon: Ticket },
  { to: "/shopkeeper/earnings", label: "Earnings", icon: Wallet },
  { to: "/shopkeeper/notifications", label: "Alerts", icon: Bell },
  { to: "/shopkeeper/reviews", label: "Reviews", icon: Star },
  { to: "/shopkeeper/settings", label: "Settings", icon: Settings },
  { to: "/support/my-tickets", label: "Help & Support", icon: LifeBuoy },
] as const;

function ShopkeeperShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, rolesLoading, roles } = useAuth() as any;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    const r: string[] = roles ?? [];
    if (!r.includes("shopkeeper") && !r.includes("admin")) {
      if (r.includes("delivery")) navigate({ to: "/delivery/dashboard", replace: true });
      else navigate({ to: "/customer/home", replace: true });
    }
  }, [user, loading, rolesLoading, roles, navigate]);

  if (pathname === "/shopkeeper") return <Navigate to="/shopkeeper/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <RoleHeader
        homeTo="/shopkeeper/dashboard"
        accountTo="/shopkeeper/settings"
        searchTo="/shopkeeper/products"
        showSearch={false}
        leading={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button aria-label="Open menu" className="md:hidden grid h-10 w-10 place-items-center rounded-xl bg-secondary hover:bg-secondary/80 transition">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SwipeableSheetContent onClose={() => setOpen(false)}>
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle className="flex items-center gap-2 font-display font-extrabold">
                  <LogoMark size="xs" className="h-7 w-7 rounded-full" />
                  Shop Menu
                </SheetTitle>
              </SheetHeader>
              <nav className="p-2">
                {DRAWER_NAV.map((n) => {
                  const Icon = n.icon;
                  const active = pathname === n.to || pathname.startsWith(n.to + "/");
                  return (
                    <Link
                      key={n.to}
                      to={n.to as any}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold transition",
                        active ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      {n.label}
                    </Link>
                  );
                })}
              </nav>
            </SwipeableSheetContent>
          </Sheet>
        }
        trailing={<NotificationBell userId={user?.id} />}
      />

      <main className="flex-1 min-w-0 pb-24"><Outlet /></main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-border md:hidden">
        <div className="grid grid-cols-6">
          {NAV.map((n) => {
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-bold transition",
                  active ? "text-primary" : "text-muted-foreground",
                )}
              >
                <span className={cn("grid h-9 w-9 place-items-center rounded-2xl transition", active ? "gradient-primary text-primary-foreground shadow-glow" : "")}>
                  <Icon className="h-5 w-5" />
                </span>
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

function SwipeableSheetContent({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  const startX = useRef<number | null>(null);
  const onTouchStart = (e: React.TouchEvent) => { startX.current = e.touches[0].clientX; };
  const onTouchEnd = (e: React.TouchEvent) => {
    if (startX.current == null) return;
    const dx = e.changedTouches[0].clientX - startX.current;
    if (dx < -60) onClose();
    startX.current = null;
  };
  return (
    <SheetContent side="left" className="w-72 p-0" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </SheetContent>
  );
}

function NotificationBell({ userId }: { userId?: string }) {
  const qc = useQueryClient();
  const { data: count = 0 } = useQuery({
    queryKey: ["shopkeeper-notification-unread", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("notifications")
        .select("*", { count: "exact", head: true })
        .eq("user_id", userId!)
        .eq("read", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`notif-bell-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: ["shopkeeper-notification-unread", userId] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [userId, qc]);

  return (
    <Link to="/shopkeeper/notifications" aria-label="Notifications" className="relative grid h-10 w-10 place-items-center rounded-full hover:bg-secondary transition">
      <Bell className="h-5 w-5" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-accent text-accent-foreground text-[10px] font-bold grid place-items-center ring-2 ring-background">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
