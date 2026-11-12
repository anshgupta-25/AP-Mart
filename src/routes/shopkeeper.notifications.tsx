import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Package, CheckCircle2 } from "lucide-react";
import { RoleShell } from "@/components/RoleShell";
import { SHOPKEEPER_NAV } from "./shopkeeper.dashboard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";

export const Route = createFileRoute("/shopkeeper/notifications")({
  component: ShopkeeperNotifications,
});

function ShopkeeperNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["shopkeeper-notifications", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id,title,body,category,data,read,created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!user?.id) return;
    const ch = supabase
      .channel(`notif-shop-${user.id}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        () => qc.invalidateQueries({ queryKey: ["shopkeeper-notifications", user.id] }),
      )
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user?.id, qc]);

  // Mark all as read on view
  useEffect(() => {
    if (!user?.id || !items.some((n: any) => !n.read)) return;
    supabase.from("notifications").update({ read: true }).eq("user_id", user.id).eq("read", false).then(() => {
      qc.invalidateQueries({ queryKey: ["shopkeeper-notification-unread", user.id] });
    });
  }, [items, user?.id, qc]);

  return (
    <RoleShell role="shopkeeper" nav={SHOPKEEPER_NAV} requireRoles={["shopkeeper", "admin"]}>
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <h1 className="font-display text-2xl font-bold mb-4">Notifications</h1>
        {isLoading ? (
          <p className="text-muted-foreground">Loading…</p>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border border-border p-8 text-center">
            <Bell className="h-10 w-10 mx-auto text-muted-foreground mb-2" />
            <p className="text-muted-foreground">No new alerts.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {items.map((n: any) => {
              const url = n.data?.url as string | undefined;
              const Inner = (
                <div className={cn(
                  "flex gap-3 rounded-2xl border border-border p-3 transition hover:bg-secondary/60",
                  !n.read && "bg-primary/5 border-primary/30",
                )}>
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary/10 text-primary shrink-0">
                    {n.category === "order" ? <Package className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold text-sm">{n.title}</div>
                    <div className="text-sm text-muted-foreground">{n.body}</div>
                    <div className="text-[11px] text-muted-foreground mt-1">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</div>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {url ? <Link to={url as any}>{Inner}</Link> : Inner}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </RoleShell>
  );
}
