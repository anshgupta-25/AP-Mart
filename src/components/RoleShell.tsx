import { Link, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export interface NavItem {
  to: string;
  label: string;
  icon: any;
}

export function RoleShell({
  role,
  nav,
  children,
  requireRoles,
}: {
  role: "shopkeeper" | "delivery" | "admin" | "customer";
  nav: NavItem[];
  children?: ReactNode;
  requireRoles?: string[];
}) {
  const { user, loading, rolesLoading, roles } = useAuth() as any;
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (!user) navigate({ to: "/login" });
    else if (requireRoles && !requireRoles.some((r) => roles?.includes(r))) {
      navigate({ to: "/dashboard" });
    }
  }, [user, loading, rolesLoading, roles, requireRoles, navigate]);

  const useSidebar = role === "shopkeeper" || role === "admin";

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-[1400px] flex">
        {useSidebar && (
          <aside className="hidden md:flex flex-col w-60 shrink-0 border-r border-border bg-card min-h-screen sticky top-0">
            <nav className="p-3 space-y-1">
              {nav.map((n) => {
                const active = pathname === n.to || pathname.startsWith(n.to + "/");
                const Icon = n.icon;
                return (
                  <Link
                    key={n.to}
                    to={n.to}
                    className={cn(
                      "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-body font-medium transition-colors",
                      active
                        ? "bg-primary-soft text-primary-ink font-semibold"
                        : "text-foreground/75 hover:bg-secondary",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {n.label}
                  </Link>
                );
              })}
            </nav>
          </aside>
        )}

        <main className="flex-1 min-w-0 pb-24 md:pb-8">{children ?? <Outlet />}</main>
      </div>

      {!useSidebar && (
        <nav className="md:hidden bar-blur hairline-t fixed bottom-0 left-0 right-0 z-30 pb-[env(safe-area-inset-bottom)]">
          <div className="grid grid-cols-5">
            {nav.slice(0, 5).map((n) => {
              const active = pathname === n.to || pathname.startsWith(n.to + "/");
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  className={cn(
                    "press flex flex-col items-center justify-center gap-1 pb-1.5 pt-2.5 text-micro font-semibold",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <Icon className={cn("h-6 w-6", active ? "stroke-[2.3]" : "stroke-[1.7]")} />
                  {n.label}
                </Link>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
}
