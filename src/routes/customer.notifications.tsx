import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/customer/notifications")({
  head: () => ({ meta: [{ title: "Notifications — AP Mart" }] }),
  component: NotificationsPage,
});

function NotificationsPage() {
  const { user } = useAuth();

  const notifications = useQuery({
    queryKey: ["customer-notifications", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, created_at, read")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-4 px-4 pb-6 pt-4">
      <h1 className="large-title">Notifications</h1>

      {notifications.isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : notifications.data?.length === 0 ? (
        <div className="py-20 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-tint-sky text-foreground/70">
            <Bell className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <h2 className="mt-4 text-subtitle font-semibold">You're all caught up</h2>
          <p className="mt-1 text-meta text-muted-foreground">Order updates will appear here.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-border/70 bg-card">
          {notifications.data?.map((n) => (
            <div
              key={n.id}
              className={`border-b border-border/60 p-3 last:border-b-0 ${n.read ? "opacity-70" : ""}`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-primary"}`}
                />
                <div className="min-w-0 flex-1">
                  <h3 className="text-meta font-semibold">{n.title}</h3>
                  {n.body && <p className="mt-0.5 text-small text-muted-foreground">{n.body}</p>}
                  <p className="mt-1.5 text-caption text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
