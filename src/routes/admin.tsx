import { createFileRoute, Link, Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import {
  LayoutDashboard, ClipboardList, Store, Users, Bell, Menu, Wallet, Package, Tag,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { RoleHeader } from "@/components/RoleHeader";
import { ADMIN_NAV_GROUPS, isAdminNavActive } from "@/lib/adminNav";
import { LogoMark } from "@/components/Logo";

const SWIPE_PAGES = [
  { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/products", label: "Products", icon: Package },
  { to: "/admin/categories", label: "Categories", icon: Tag },
] as const;

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — AP Mart" }] }),
  component: AdminShell,
});

const BOTTOM_NAV = [
  { to: "/admin/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/admin/orders", label: "Orders", icon: ClipboardList },
  { to: "/admin/shops", label: "Shops", icon: Store },
  { to: "/admin/customers", label: "Users", icon: Users },
  { to: "/admin/payments", label: "Payments", icon: Wallet },
] as const;

function AdminNavList({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <nav className="p-2 space-y-4">
      {ADMIN_NAV_GROUPS.map((group) => (
        <div key={group.label}>
          <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {group.label}
          </div>
          <div className="space-y-0.5">
            {group.items.map((n) => {
              const Icon = n.icon;
              const active = isAdminNavActive(pathname, n.to);
              return (
                <Link
                  key={n.to}
                  to={n.to as any}
                  onClick={onNavigate}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition",
                    active ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground",
                  )}
                >
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="min-w-0 truncate">{n.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  );
}



function AdminShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, rolesLoading, isAdmin } = useAuth() as any;
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    if (!isAdmin) navigate({ to: "/customer/home", replace: true });
  }, [user, loading, rolesLoading, isAdmin, navigate]);

  if (pathname === "/admin") return <Navigate to="/admin/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <RoleHeader
        homeTo="/admin/dashboard"
        accountTo="/admin/settings"
        searchTo="/admin/products"
        showSearch={false}
        leading={
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button aria-label="Open menu" className="grid h-10 w-10 place-items-center rounded-xl bg-secondary hover:bg-secondary/80 transition">
                <Menu className="h-5 w-5" />
              </button>
            </SheetTrigger>
            <SwipeableSheetContent onClose={() => setOpen(false)}>
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle className="flex items-center gap-2 font-display font-extrabold">
                  <LogoMark size="xs" className="h-7 w-7 rounded-full" />
                  Admin Menu
                </SheetTitle>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto overscroll-contain pb-8">
                <AdminNavList pathname={pathname} onNavigate={() => setOpen(false)} />
              </div>

            </SwipeableSheetContent>
          </Sheet>
        }
        trailing={
          <Link to="/admin/notifications" aria-label="Notifications" className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary transition">
            <Bell className="h-5 w-5" />
          </Link>
        }
      />

      <SwipeTabs pathname={pathname} />

      <main className="flex-1 min-w-0 pb-24">
        <SwipeArea pathname={pathname}>
          <Outlet />
        </SwipeArea>
      </main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 glass border-t border-border">
        <div className="grid grid-cols-5">
          {BOTTOM_NAV.map((n) => {
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

function swipeIndex(pathname: string) {
  return SWIPE_PAGES.findIndex((p) => pathname === p.to || pathname.startsWith(p.to + "/"));
}

function SwipeTabs({ pathname }: { pathname: string }) {
  const idx = swipeIndex(pathname);
  if (idx < 0) return null;
  return (
    <div className="md:hidden sticky top-0 z-30 bg-background/95 backdrop-blur border-b border-border">
      <div className="flex px-2 py-2 gap-1 overflow-x-auto no-scrollbar">
        {SWIPE_PAGES.map((p, i) => {
          const Icon = p.icon;
          const active = i === idx;
          return (
            <Link
              key={p.to}
              to={p.to}
              className={cn(
                "relative flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition",
                active ? "text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {active && (
                <motion.span
                  layoutId="admin-swipe-pill"
                  className="absolute inset-0 gradient-primary rounded-full shadow-glow"
                  transition={{ type: "spring", stiffness: 400, damping: 32 }}
                />
              )}
              <span className="relative flex items-center gap-1.5">
                <Icon className="h-3.5 w-3.5" />
                {p.label}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function SwipeArea({ pathname, children }: { pathname: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  const idx = swipeIndex(pathname);
  if (idx < 0) return <>{children}</>;

  const onDragEnd = (_: unknown, info: PanInfo) => {
    const { offset, velocity } = info;
    const swipe = offset.x;
    const power = Math.abs(swipe) * Math.abs(velocity.x);
    if (swipe < -60 && (power > 1000 || swipe < -120) && idx < SWIPE_PAGES.length - 1) {
      navigate({ to: SWIPE_PAGES[idx + 1].to });
    } else if (swipe > 60 && (power > 1000 || swipe > 120) && idx > 0) {
      navigate({ to: SWIPE_PAGES[idx - 1].to });
    }
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pathname}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.25}
        onDragEnd={onDragEnd}
        initial={{ opacity: 0, x: 24 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: -24 }}
        transition={{ duration: 0.18 }}
        className="touch-pan-y"
      >
        {children}
      </motion.div>
    </AnimatePresence>
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
    <SheetContent side="left" className="w-72 p-0 flex flex-col h-full max-h-screen" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {children}
    </SheetContent>
  );
}
