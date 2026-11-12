import { createFileRoute, Link, Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, PackageSearch, History, Wallet, User, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { RoleHeader } from "@/components/RoleHeader";

export const Route = createFileRoute("/delivery")({
  head: () => ({ meta: [{ title: "Delivery — AP Mart" }] }),
  component: DeliveryShell,
});

const NAV = [
  { to: "/delivery/dashboard", label: "Active", icon: LayoutDashboard },
  { to: "/delivery/available-orders", label: "Available", icon: PackageSearch },
  { to: "/delivery/history", label: "History", icon: History },
  { to: "/delivery/earnings", label: "Earnings", icon: Wallet },
  { to: "/delivery/profile", label: "Account", icon: User },
] as const;

function DeliveryShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, rolesLoading, roles } = useAuth() as any;
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    const r: string[] = roles ?? [];
    if (!r.includes("delivery") && !r.includes("admin")) {
      if (r.includes("shopkeeper")) navigate({ to: "/shopkeeper/dashboard", replace: true });
      else navigate({ to: "/customer/home", replace: true });
    }
  }, [user, loading, rolesLoading, roles, navigate]);

  if (pathname === "/delivery") return <Navigate to="/delivery/dashboard" replace />;

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <RoleHeader
        homeTo="/delivery/dashboard"
        accountTo="/delivery/profile"
        searchTo="/delivery/available-orders"
        showSearch={false}
        trailing={
          <Link to="/delivery/notifications" aria-label="Notifications" className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary transition">
            <Bell className="h-5 w-5" />
          </Link>
        }
      />

      <main className="flex-1 min-w-0 pb-24"><Outlet /></main>

      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-background border-t border-border">
        <div className="grid grid-cols-5">
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
