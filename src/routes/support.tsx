import { createFileRoute, Link, Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { LayoutDashboard, Inbox, User, LifeBuoy, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { RoleHeader } from "@/components/RoleHeader";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "Support — AP Mart" }] }),
  component: SupportShell,
});

const NAV = [
  { to: "/support/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/support/tickets", label: "Tickets", icon: Inbox },
  { to: "/support/profile", label: "Profile", icon: User },
] as const;

function SupportShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, rolesLoading, roles } = useAuth() as any;
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    const r: string[] = roles ?? [];
    // Allow my-tickets/ticket subroutes for anyone signed-in
    if (pathname.startsWith("/support/my-tickets") || pathname.startsWith("/support/ticket/")) return;
    if (!r.includes("support") && !r.includes("admin")) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [user, loading, rolesLoading, roles, navigate, pathname]);

  if (pathname === "/support") return <Navigate to="/support/dashboard" replace />;

  // Light shell for end-user pages
  if (pathname.startsWith("/support/my-tickets") || pathname.startsWith("/support/ticket/")) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <RoleHeader homeTo="/dashboard" accountTo="/account" showSearch={false} />
        <main className="flex-1 min-w-0 pb-12"><Outlet /></main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border bg-card/40 min-h-screen sticky top-0">
        <div className="p-4 border-b border-border flex items-center gap-2 font-display font-extrabold">
          <span className="grid h-7 w-7 place-items-center rounded-full gradient-primary text-primary-foreground"><LifeBuoy className="h-4 w-4" /></span>
          Support
        </div>
        <nav className="p-3 space-y-1">
          {NAV.map(n => {
            const Icon = n.icon;
            const active = pathname === n.to || pathname.startsWith(n.to + "/");
            return (
              <Link key={n.to} to={n.to as any} className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold",
                active ? "bg-foreground text-background" : "text-foreground hover:bg-secondary",
              )}>
                <Icon className="h-4 w-4" /> {n.label}
              </Link>
            );
          })}
        </nav>
      </aside>
      <div className="flex-1 min-w-0 flex flex-col">
        <RoleHeader
          homeTo="/support/dashboard"
          accountTo="/support/profile"
          showSearch={false}
          trailing={
            <Link to="/customer/notifications" aria-label="Notifications" className="grid h-10 w-10 place-items-center rounded-full hover:bg-secondary transition">
              <Bell className="h-5 w-5" />
            </Link>
          }
        />
        <main className="flex-1 min-w-0 pb-24 md:pb-8"><Outlet /></main>
        <nav className="md:hidden fixed bottom-0 left-0 right-0 z-30 glass border-t border-border">
          <div className="grid grid-cols-3">
            {NAV.map(n => {
              const Icon = n.icon;
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              return (
                <Link key={n.to} to={n.to as any} className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-bold",
                  active ? "text-primary" : "text-muted-foreground",
                )}>
                  <Icon className={cn("h-5 w-5", active && "text-primary")} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export { NAV as SUPPORT_NAV };
