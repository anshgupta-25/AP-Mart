import { Link } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { supportUnreadKey, supportUnreadQuery } from "@/lib/supportNotificationKeys";

/**
 * Support portal bell: opens /support/notifications (it used to open the customer page) and
 * shows how many unread notifications the agent has, updating live.
 */
export function SupportNotificationBell({ userId }: { userId?: string }) {
  const qc = useQueryClient();

  const { data: count = 0 } = useQuery(supportUnreadQuery(userId));

  useEffect(() => {
    if (!userId) return;
    const ch = supabase
      .channel(`support-bell-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
        () => qc.invalidateQueries({ queryKey: supportUnreadKey(userId) }),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [userId, qc]);

  return (
    <Link
      to="/support/notifications"
      aria-label={count > 0 ? `Notifications, ${count} unread` : "Notifications"}
      className="press relative grid h-9 w-9 place-items-center rounded-full bg-card"
    >
      <Bell className="h-[18px] w-[18px]" />
      {count > 0 && (
        <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-primary px-1 text-micro font-semibold text-primary-foreground ring-2 ring-card">
          {count > 9 ? "9+" : count}
        </span>
      )}
    </Link>
  );
}
