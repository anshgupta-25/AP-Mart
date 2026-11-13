import {
  createFileRoute,
  Link,
  Navigate,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { RoleHeader } from "@/components/RoleHeader";
import { AppShell } from "@/components/shell/AppShell";
import { SUPPORT_NAV } from "@/lib/nav/support";

export const Route = createFileRoute("/support")({
  head: () => ({ meta: [{ title: "Support — AP Mart" }] }),
  component: SupportShell,
});

function SupportShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, rolesLoading, roles } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    const r: string[] = roles ?? [];
    // Allow my-tickets/ticket subroutes for anyone signed-in
    if (pathname.startsWith("/support/my-tickets") || pathname.startsWith("/support/ticket/"))
      return;
    if (!r.includes("support") && !r.includes("admin")) {
      navigate({ to: "/dashboard", replace: true });
    }
  }, [user, loading, rolesLoading, roles, navigate, pathname]);

  if (pathname === "/support") return <Navigate to="/support/dashboard" replace />;

  // Light shell for end-user pages (any signed-in user, not only agents)
  if (pathname.startsWith("/support/my-tickets") || pathname.startsWith("/support/ticket/")) {
    return (
      <div className="min-h-screen bg-background flex flex-col">
        <RoleHeader homeTo="/dashboard" accountTo="/account" showSearch={false} />
        <main className="mx-auto w-full max-w-3xl flex-1 min-w-0 pb-12">
          <Outlet />
        </main>
      </div>
    );
  }

  return (
    <AppShell
      nav={SUPPORT_NAV}
      maxWidth="max-w-6xl"
      trailing={
        <Link
          to="/customer/notifications"
          aria-label="Notifications"
          className="press grid h-9 w-9 place-items-center rounded-full bg-card"
        >
          <Bell className="h-[18px] w-[18px]" />
        </Link>
      }
    />
  );
}
