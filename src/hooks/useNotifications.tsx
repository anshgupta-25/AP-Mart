import { useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { refreshPushToken, disablePush, onForegroundMessage } from "@/integrations/firebase/messaging";
import { toast } from "sonner";

/**
 * - Keeps the signed-in user's FCM token stored in Supabase (refresh on login)
 * - Shows foreground FCM messages as toasts
 * - Subscribes to Realtime on the `notifications` table for in-app toasts
 */
export function useNotifications() {
  const { user } = useAuth();
  const registered = useRef<string | null>(null);

  // FCM token refresh on login / cleanup on logout
  useEffect(() => {
    if (!user) {
      if (registered.current) {
        const previous = registered.current;
        registered.current = null;
        disablePush(previous);
      }
      return;
    }
    if (registered.current === user.id) return;
    registered.current = user.id;
    const t = setTimeout(() => { refreshPushToken(user.id); }, 1500);
    return () => clearTimeout(t);
  }, [user]);

  // Foreground push messages
  useEffect(() => {
    if (!user) return;
    let unsubscribe: (() => void) | undefined;
    onForegroundMessage((payload) => {
      const title = payload?.notification?.title ?? payload?.data?.title;
      if (!title) return;
      toast(title, { description: payload?.notification?.body ?? payload?.data?.body });
    }).then((fn) => { unsubscribe = fn; });
    return () => { unsubscribe?.(); };
  }, [user]);

  // Realtime in-app notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("notifications-" + user.id)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const n: any = payload.new;
          toast(n.title, { description: n.body ?? undefined });
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);
}
