import { useEffect, useState } from "react";
import { Bell, BellRing, RefreshCw, Send } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { enablePush, getCurrentToken, isFcmConfigured } from "@/integrations/firebase/messaging";

type Diag = {
  configured: boolean;
  permission: string;
  swScript: string | null;
  token: string | null;
  storedTokens: number;
};

export function FcmDiagnostics() {
  const { user } = useAuth();
  const [d, setD] = useState<Diag | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const regs = "serviceWorker" in navigator ? await navigator.serviceWorker.getRegistrations() : [];
    const sw = regs.find((r) => (r.active || r.installing || r.waiting)?.scriptURL.includes("firebase-messaging-sw"));
    const token = await getCurrentToken();
    let storedTokens = 0;
    if (user) {
      const { count } = await supabase
        .from("fcm_tokens")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id);
      storedTokens = count ?? 0;
    }
    setD({
      configured: isFcmConfigured(),
      permission: typeof Notification !== "undefined" ? Notification.permission : "unavailable",
      swScript: (sw?.active || sw?.installing || sw?.waiting)?.scriptURL ?? null,
      token,
      storedTokens,
    });
  }

  useEffect(() => { refresh(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [user?.id]);

  async function handleEnable() {
    if (!user) return;
    setBusy(true);
    const result = await enablePush(user.id);
    setBusy(false);
    const messages: Record<string, string> = {
      registered: "Push notifications enabled on this device.",
      "not-configured": "Firebase Messaging is not connected yet — connect it in project integrations (include web push).",
      unsupported: "This browser does not support web push.",
      "open-in-new-tab": "Open the app in its own browser tab to allow notifications — the preview iframe blocks the prompt.",
      denied: "Notifications are blocked. Allow them in your browser's site settings.",
      error: result.error ?? "Something went wrong.",
    };
    (result.status === "registered" ? toast.success : toast.error)(messages[result.status]);
    refresh();
  }

  async function handleTest() {
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("notifications").insert({
      user_id: user.id,
      title: "AP Mart test notification",
      body: "If you see this as a system notification, FCM push is working.",
      category: "system",
      data: { url: "/admin/notifications" },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("Test notification queued — push dispatch runs server-side.");
  }

  return (
    <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <BellRing className="h-5 w-5 text-primary" />
        <h2 className="font-display font-bold">Firebase Cloud Messaging</h2>
      </div>

      <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
        <Row label="Config">
          {d?.configured ? <Badge>Ready</Badge> : <Badge variant="destructive">Missing web push keys</Badge>}
        </Row>
        <Row label="Permission">
          <Badge variant={d?.permission === "granted" ? "default" : "secondary"}>{d?.permission ?? "—"}</Badge>
        </Row>
        <Row label="Service worker">
          <span className="truncate text-muted-foreground">{d?.swScript ? "registered" : "not registered"}</span>
        </Row>
        <Row label="Tokens stored for you">
          <span className="text-muted-foreground">{d?.storedTokens ?? 0}</span>
        </Row>
      </dl>

      {d?.token && (
        <p className="break-all rounded-xl bg-secondary/60 p-3 font-mono text-[11px] text-muted-foreground">
          {d.token.slice(0, 24)}…{d.token.slice(-12)}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={handleEnable} disabled={busy || !user}>
          <Bell className="mr-2 h-4 w-4" /> Enable on this device
        </Button>
        <Button variant="outline" onClick={handleTest} disabled={busy || !user}>
          <Send className="mr-2 h-4 w-4" /> Send test push
        </Button>
        <Button variant="ghost" onClick={refresh} disabled={busy}>
          <RefreshCw className="mr-2 h-4 w-4" /> Refresh
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        In-app notification history and realtime toasts continue to come from the database. Firebase only delivers
        the system-level push.
      </p>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="flex min-w-0 items-center">{children}</dd>
    </div>
  );
}
