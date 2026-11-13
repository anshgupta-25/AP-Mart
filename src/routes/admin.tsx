import { createFileRoute, Link, Navigate, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { Bell, User } from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/shell/AppShell";
import { ADMIN_PORTAL_NAV } from "@/lib/nav/admin";

export const Route = createFileRoute("/admin")({
  head: () => ({ meta: [{ title: "Admin — AP Mart" }] }),
  component: AdminShell,
});

function AdminShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, rolesLoading, isAdmin } = useAuth() as any;
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (!user) { navigate({ to: "/login", replace: true }); return; }
    if (!isAdmin) navigate({ to: "/customer/home", replace: true });
  }, [user, loading, rolesLoading, isAdmin, navigate]);

  if (pathname === "/admin") return <Navigate to="/admin/dashboard" replace />;

  return (
    <AppShell
      nav={ADMIN_PORTAL_NAV}
      trailing={
        <>
          <Link to="/admin/notifications" aria-label="Notifications" className="press grid h-9 w-9 place-items-center rounded-full bg-card shadow-soft">
            <Bell className="h-[18px] w-[18px]" />
          </Link>
          <Link to="/admin/settings" aria-label="Account" className="press grid h-9 w-9 place-items-center rounded-full bg-card shadow-soft">
            <User className="h-[18px] w-[18px]" />
          </Link>
        </>
      }
    />
  );
}
