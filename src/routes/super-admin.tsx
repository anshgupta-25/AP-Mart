import { createFileRoute, Link, Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/shell/AppShell";
import { SUPER_ADMIN_NAV } from "@/lib/nav/superadmin";

export const Route = createFileRoute("/super-admin")({
  head: () => ({ meta: [{ title: "Super Admin — AP Mart" }] }),
  component: SuperAdminShell,
});

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
      <div className="grid min-h-screen place-items-center bg-background">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user || !isSuperAdmin) return null;

  return (
    <AppShell
      nav={SUPER_ADMIN_NAV}
      title="Super Admin"
      trailing={
        <Link to="/admin/dashboard" className="press flex h-8 items-center rounded-full bg-card px-3.5 text-small font-medium">
          Admin view
        </Link>
      }
    >
      <div className="space-y-5 px-4 py-4 md:px-6 md:py-6">
        <Outlet />
      </div>
    </AppShell>
  );
}
