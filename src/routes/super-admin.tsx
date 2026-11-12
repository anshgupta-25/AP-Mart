import { createFileRoute, Link, Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2, ShieldCheck, Users, ScrollText, Crown, BarChart3, Sliders, KeyRound, Database } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/super-admin")({
  head: () => ({ meta: [{ title: "Super Admin — AP Mart" }] }),
  component: SuperAdminShell,
});

const NAV = [
  { to: "/super-admin/dashboard", label: "Overview", icon: Crown },
  { to: "/super-admin/access", label: "Roles & Access", icon: Users },
  { to: "/super-admin/analytics", label: "Revenue", icon: BarChart3 },
  { to: "/super-admin/settings", label: "Platform Settings", icon: Sliders },
  { to: "/super-admin/integrations", label: "API Keys", icon: KeyRound },
  { to: "/super-admin/health", label: "Database", icon: Database },
  { to: "/super-admin/audit", label: "Security Log", icon: ScrollText },
] as const;

function SuperAdminShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, rolesLoading, isSuperAdmin } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (!user) { navigate({ to: "/staff-login", replace: true }); return; }
    if (!isSuperAdmin) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, rolesLoading, isSuperAdmin, navigate]);

  if (pathname === "/super-admin") return <Navigate to="/super-admin/dashboard" replace />;

  if (loading || rolesLoading) {
    return (
      <div className="min-h-screen grid place-items-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isSuperAdmin) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-[#0e3b2a] text-white">
        <div className="mx-auto max-w-[1200px] px-4 h-14 flex items-center justify-between">
          <div className="flex items-center gap-2 font-display font-extrabold">
            <ShieldCheck className="h-5 w-5 text-lime-300" />
            Super Admin
            <span className="ml-2 rounded-full bg-lime-400/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-lime-300">
              System Owner
            </span>
          </div>
          <Link to="/admin/dashboard" className="text-xs font-semibold text-white/70 hover:text-white">
            Admin view →
          </Link>
        </div>
        <nav className="mx-auto max-w-[1200px] px-2 flex gap-1 overflow-x-auto pb-2">
          {NAV.map((n) => {
            const active = pathname === n.to;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-bold transition",
                  active ? "bg-white text-[#0e3b2a]" : "text-white/70 hover:bg-white/10 hover:text-white",
                )}
              >
                <n.icon className="h-3.5 w-3.5" />
                {n.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-[1200px] p-4 pb-24">
        <Outlet />
      </main>
    </div>
  );
}
