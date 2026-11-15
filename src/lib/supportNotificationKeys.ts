import { supabase } from "@/integrations/supabase/client";

/** React Query keys for the Support portal's notifications, shared by the bell and the page. */
export const supportUnreadKey = (userId?: string) => ["support-notification-unread", userId];
export const supportNotificationsKey = (userId?: string) => ["support-notifications", userId];

/**
 * The agent's total unread count (not just the latest 100 the page lists). Shared by the bell
 * badge and the page, so both always show the same number from one cached request.
 */
export const supportUnreadQuery = (userId?: string) => ({
  queryKey: supportUnreadKey(userId),
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
