import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell, CheckCheck, Inbox } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { supportNotificationsKey, supportUnreadKey } from "@/lib/supportNotificationKeys";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/support/notifications")({
  head: () => ({ meta: [{ title: "Notifications — AP Mart Support" }] }),
  component: SupportNotifications,
});

/** Where a notification should open: the deep link stored with it (e.g. /support/tickets/<id>). */
const urlOf = (data: unknown): string | undefined => {
  const u = (data as { url?: unknown } | null)?.url;
  return typeof u === "string" && u.startsWith("/") ? u : undefined;
};

function SupportNotifications() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const userId = user?.id;

  const items = useQuery({
    queryKey: supportNotificationsKey(userId),
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, category, data, read, created_at")
        .eq("user_id", userId!)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
  });

  // New notifications appear without a refresh.
  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`support-notifications-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: supportNotificationsKey(userId) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  const refreshRead = () => {
    qc.invalidateQueries({ queryKey: supportNotificationsKey(userId) });
    qc.invalidateQueries({ queryKey: supportUnreadKey(userId) });
  };

  const markRead = async (id: string) => {
    if (!userId) return;
    await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", userId);
    refreshRead();
  };

  const markAllRead = async () => {
    if (!userId) return;
    await supabase
      .from("notifications")
      .update({ read: true })
      .eq("user_id", userId)
      .eq("read", false);
    refreshRead();
  };

  const list = items.data ?? [];
  const unread = list.filter((n) => !n.read).length;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-8 pt-4 md:px-6">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="large-title">Notifications</h1>
          {!items.isLoading && !items.isError && list.length > 0 && (
            <p className="mt-0.5 text-meta text-muted-foreground">
              {unread > 0 ? `${unread} unread` : "All read"}
            </p>
          )}
        </div>
        {unread > 0 && (
          <button
            type="button"
            onClick={markAllRead}
            className="press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 text-small font-medium"
          >
            <CheckCheck className="h-3.5 w-3.5 text-primary" /> Mark all read
          </button>
        )}
      </div>

      {items.isLoading ? (
        <div className="space-y-2.5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-[72px] rounded-xl" />
          ))}
        </div>
      ) : items.isError ? (
        <div className="rounded-xl border border-border/70 bg-card px-6 py-10 text-center">
          <div className="text-body font-semibold">Couldn’t load notifications</div>
          <p className="mt-1 text-meta text-muted-foreground">Check your connection and retry.</p>
          <button
            type="button"
            onClick={() => items.refetch()}
            className="press mt-4 h-9 rounded-full bg-secondary px-4 text-meta font-medium"
          >
            Retry
          </button>
        </div>
      ) : list.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card px-6 py-12 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary-ink">
            <Bell className="h-5 w-5" />
          </div>
          <div className="mt-4 text-body font-semibold">You’re all caught up</div>
          <p className="mx-auto mt-1 max-w-xs text-meta text-muted-foreground">
            New tickets, customer replies and assignments will show up here.
          </p>
          <Link
            to="/support/tickets"
            className="press mt-5 inline-flex h-9 items-center rounded-full bg-secondary px-4 text-meta font-medium"
          >
            View tickets
          </Link>
        </div>
      ) : (
        <ul className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card">
          {list.map((n) => {
            const url = urlOf(n.data);
            const Icon = n.category === "support" ? Inbox : Bell;
            const row = (
              <div
                className={cn(
                  "flex gap-3 p-4 transition-colors",
                  !n.read && "bg-primary-soft/50",
                  url && "press",
                )}
              >
                <span
                  className={cn(
                    "grid h-10 w-10 shrink-0 place-items-center rounded-full",
                    n.read
                      ? "bg-secondary text-muted-foreground"
                      : "bg-primary-soft text-primary-ink",
                  )}
                >
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className={cn("text-body", n.read ? "font-medium" : "font-semibold")}>
                      {n.title}
                    </div>
                    {!n.read && (
                      <span
                        aria-label="Unread"
                        className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                      />
                    )}
                  </div>
                  {n.body && (
                    <p className="mt-0.5 line-clamp-2 text-meta text-muted-foreground">{n.body}</p>
                  )}
                  <p className="mt-1.5 text-small text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
            return (
              <li key={n.id}>
                {url ? (
                  <Link to={url} onClick={() => !n.read && markRead(n.id)}>
                    {row}
                  </Link>
                ) : (
                  <button
                    type="button"
                    className="block w-full text-left"
                    onClick={() => !n.read && markRead(n.id)}
                  >
                    {row}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
