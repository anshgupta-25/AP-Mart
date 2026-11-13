import {
  createFileRoute,
  Link,
  Navigate,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, User } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { AppShell } from "@/components/shell/AppShell";
import { SHOPKEEPER_NAV } from "@/lib/nav/shopkeeper";

export const Route = createFileRoute("/shopkeeper")({
  head: () => ({ meta: [{ title: "Shopkeeper — AP Mart" }] }),
  component: ShopkeeperShell,
});

function ShopkeeperShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, rolesLoading, roles } = useAuth() as any;
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    const r: string[] = roles ?? [];
    if (!r.includes("shopkeeper") && !r.includes("admin")) {
      if (r.includes("delivery")) navigate({ to: "/delivery/dashboard", replace: true });
      else navigate({ to: "/customer/home", replace: true });
    }
  }, [user, loading, rolesLoading, roles, navigate]);

  if (pathname === "/shopkeeper") return <Navigate to="/shopkeeper/dashboard" replace />;

  return (
    <AppShell
      nav={SHOPKEEPER_NAV}
      maxWidth="max-w-none"
      trailing={
        <div className="flex items-center gap-2">
          <NotificationBell userId={user?.id} />
          <Link
            to="/shopkeeper/settings"
            aria-label="Account"
            className="press grid h-9 w-9 place-items-center rounded-full bg-card shadow-soft"
          >
            <User className="h-[18px] w-[18px]" />
          </Link>
        </div>
      }
    />
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
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  return (
    <Link
      to="/shopkeeper/notifications"
      aria-label="Notifications"
      className="press relative grid h-9 w-9 place-items-center rounded-full bg-card shadow-soft"
    >
      <Bell className="h-[18px] w-[18px]" />
      {count > 0 && (
        <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-micro font-semibold grid place-items-center ring-2 ring-card">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
