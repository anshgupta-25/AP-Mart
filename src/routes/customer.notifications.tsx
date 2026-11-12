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
    <div className="px-4 py-4">
      <h1 className="font-display text-2xl font-extrabold mb-4">Notifications</h1>

      {notifications.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
      ) : notifications.data?.length === 0 ? (
        <div className="text-center py-16">
          <Bell className="h-14 w-14 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No notifications yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {notifications.data?.map((n) => (
            <div
              key={n.id}
              className={`rounded-2xl border border-border bg-card p-4 shadow-card ${
                n.read ? "opacity-70" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-bold text-sm">{n.title}</h3>
                  {n.body && (
                    <p className="text-sm text-muted-foreground mt-1">{n.body}</p>
                  )}
                </div>
                {!n.read && (
                  <span className="shrink-0 mt-1 h-2.5 w-2.5 rounded-full bg-primary" />
                )}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
