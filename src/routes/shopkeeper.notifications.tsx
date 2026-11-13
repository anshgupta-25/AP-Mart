import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, Package, CheckCircle2 } from "lucide-react";
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
    return () => {
      supabase.removeChannel(ch);
    };
  }, [user?.id, qc]);

  // Mark all as read on view
  useEffect(() => {
    if (!user?.id || !items.some((n) => !n.read)) return;
    supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false)
      .then(() => {
        qc.invalidateQueries({ queryKey: ["shopkeeper-notification-unread", user.id] });
      });
  }, [items, user?.id, qc]);

  return (
    <>
      <div className="mx-auto max-w-2xl space-y-5 px-4 py-4 md:px-6">
        <h1 className="large-title">Alerts</h1>
        {isLoading ? (
          <div className="h-32 rounded-xl shimmer" />
        ) : items.length === 0 ? (
          <div className="rounded-xl bg-card px-6 py-12 text-center border border-border/70">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary-ink">
              <Bell className="h-6 w-6" />
            </div>
            <div className="mt-4 text-body font-semibold">You're all caught up</div>
            <p className="mt-1 text-body text-muted-foreground">New alerts will appear here.</p>
          </div>
        ) : (
          <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card border border-border/70">
            {items.map((n: any) => {
              const url = n.data?.url as string | undefined;
              const Inner = (
                <div
                  className={cn(
                    "press flex gap-3 p-4 transition-colors",
                    !n.read && "bg-primary-soft/50",
                  )}
                >
                  <div className="grid h-10 w-10 place-items-center rounded-full bg-primary-soft text-primary-ink shrink-0">
                    {n.category === "order" ? (
                      <Package className="h-5 w-5" />
                    ) : (
                      <CheckCircle2 className="h-5 w-5" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-body font-semibold">{n.title}</div>
                    <div className="mt-0.5 text-body text-muted-foreground">{n.body}</div>
                    <div className="mt-1.5 text-small text-muted-foreground">
                      {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                    </div>
                  </div>
                </div>
              );
              return <li key={n.id}>{url ? <Link to={url}>{Inner}</Link> : Inner}</li>;
            })}
          </ul>
        )}
      </div>
    </>
  );
}
