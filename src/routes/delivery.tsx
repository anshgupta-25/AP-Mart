import {
  createFileRoute,
  Link,
  Navigate,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "@/components/shell/AppShell";
import { DELIVERY_NAV } from "@/lib/nav/delivery";

export const Route = createFileRoute("/delivery")({
  head: () => ({ meta: [{ title: "Delivery — AP Mart" }] }),
  component: DeliveryShell,
});

function DeliveryShell() {
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
    if (!r.includes("delivery") && !r.includes("admin")) {
      if (r.includes("shopkeeper")) navigate({ to: "/shopkeeper/dashboard", replace: true });
      else navigate({ to: "/customer/home", replace: true });
    }
  }, [user, loading, rolesLoading, roles, navigate]);

  if (pathname === "/delivery") return <Navigate to="/delivery/dashboard" replace />;

  return (
    <AppShell
      nav={DELIVERY_NAV}
      maxWidth="max-w-3xl"
      trailing={
        <Link
          to="/delivery/notifications"
          aria-label="Notifications"
          className="press grid h-9 w-9 place-items-center rounded-full bg-card"
        >
          <Bell className="h-[18px] w-[18px]" />
        </Link>
      }
    />
  );
}
