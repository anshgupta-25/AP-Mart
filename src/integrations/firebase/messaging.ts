// Firebase Cloud Messaging (web push) integration.
// Supabase stays responsible for auth / database / storage / realtime —
// Firebase is used ONLY to deliver push notifications.
import { supabase } from "@/integrations/supabase/client";

const apiKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_WEB_API_KEY as string | undefined;
const projectId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_PROJECT_ID as string | undefined;
const appId = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_APP_ID as string | undefined;
const vapidKey = import.meta.env.VITE_LOVABLE_CONNECTOR_FIREBASE_MESSAGING_VAPID_KEY as string | undefined;

export const firebaseConfig = {
  apiKey: apiKey ?? "",
  projectId: projectId ?? "",
  appId: appId ?? "",
  // messagingSenderId is the middle segment of the app id: 1:<sender>:web:<hash>
  messagingSenderId: appId?.split(":")[1] ?? "",
};

export function isFcmConfigured(): boolean {
  return Boolean(
    firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.appId && firebaseConfig.messagingSenderId && vapidKey,
  );
}

export type PushStatus =
  | "registered"
  | "not-configured"
  | "unsupported"
  | "open-in-new-tab"
  | "denied"
  | "error";

export type PushResult = { status: PushStatus; token?: string; error?: string };

let messagingPromise: Promise<any> | null = null;

async function getMessagingInstance() {
  if (!messagingPromise) {
    messagingPromise = (async () => {
      const [{ initializeApp, getApps }, { getMessaging }] = await Promise.all([
        import("firebase/app"),
        import("firebase/messaging"),
      ]);
      const app = getApps().length ? getApps()[0]! : initializeApp(firebaseConfig);
      return getMessaging(app);
    })();
  }
  return messagingPromise;
}

async function registerServiceWorker(): Promise<ServiceWorkerRegistration> {
  const query = new URLSearchParams(firebaseConfig as Record<string, string>).toString();
  return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${query}`, { scope: "/" });
}

async function storeToken(userId: string, token: string) {
  const { error } = await supabase.from("fcm_tokens").upsert(
    {
      user_id: userId,
      token,
      platform: "web",
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) console.warn("[FCM] failed to store token", error.message);
}

/**
 * Request permission (must be called from a user gesture on first run),
 * register the service worker, fetch the FCM token and store it in Supabase.
 */
export async function enablePush(userId: string, opts?: { requestPermission?: boolean }): Promise<PushResult> {
  try {
    if (!isFcmConfigured()) return { status: "not-configured" };
    if (typeof window === "undefined" || !("Notification" in window) || !("serviceWorker" in navigator)) {
      return { status: "unsupported" };
    }
    const { isSupported, getToken } = await import("firebase/messaging");
    if (!(await isSupported())) return { status: "unsupported" };

    let permission = Notification.permission;
    if (permission === "default") {
      // Browsers refuse the prompt inside a cross-origin iframe (Lovable preview).
      if (window.top !== window.self) return { status: "open-in-new-tab" };
      if (opts?.requestPermission === false) return { status: "denied" };
      permission = await Notification.requestPermission();
    }
    if (permission !== "granted") return { status: "denied" };

    const serviceWorkerRegistration = await registerServiceWorker();
    const messaging = await getMessagingInstance();
    const token = await getToken(messaging, { vapidKey: vapidKey!, serviceWorkerRegistration });
    if (!token) return { status: "denied" };

    await storeToken(userId, token);
    return { status: "registered", token };
  } catch (e: any) {
    console.warn("[FCM] enablePush error", e);
    return { status: "error", error: String(e?.message ?? e) };
  }
}

/**
 * Refresh the stored token (FCM may rotate it) without prompting the user.
 * Safe to call on every sign-in.
 */
export async function refreshPushToken(userId: string): Promise<PushResult> {
  if (typeof window === "undefined" || !("Notification" in window)) return { status: "unsupported" };
  if (Notification.permission !== "granted") return { status: "denied" };
  return enablePush(userId, { requestPermission: false });
}

/** Foreground messages: FCM does not show a notification itself, so we surface it. */
export async function onForegroundMessage(handler: (payload: any) => void): Promise<() => void> {
  try {
    if (!isFcmConfigured()) return () => {};
    const { onMessage, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return () => {};
    const messaging = await getMessagingInstance();
    return onMessage(messaging, handler);
  } catch {
    return () => {};
  }
}

/** Delete the device token locally and remove it from Supabase (logout cleanup). */
export async function disablePush(userId?: string): Promise<void> {
  try {
    if (!isFcmConfigured()) return;
    const { getToken, deleteToken, isSupported } = await import("firebase/messaging");
    if (!(await isSupported())) return;
    if (Notification.permission !== "granted") return;

    const messaging = await getMessagingInstance();
    const registration = await navigator.serviceWorker.getRegistration("/");
    let token: string | null = null;
    try {
      token = await getToken(messaging, { vapidKey: vapidKey!, serviceWorkerRegistration: registration ?? undefined });
    } catch {
      token = null;
    }
    if (token) {
      const query = supabase.from("fcm_tokens").delete().eq("token", token);
      if (userId) await query.eq("user_id", userId);
      else await query;
      try { await deleteToken(messaging); } catch {}
    }
  } catch (e) {
    console.warn("[FCM] disablePush error", e);
  }
}

export async function getCurrentToken(): Promise<string | null> {
  try {
    if (!isFcmConfigured() || Notification.permission !== "granted") return null;
    const { getToken } = await import("firebase/messaging");
    const messaging = await getMessagingInstance();
    const registration = (await navigator.serviceWorker.getRegistration("/")) ?? (await registerServiceWorker());
    return await getToken(messaging, { vapidKey: vapidKey!, serviceWorkerRegistration: registration });
  } catch {
    return null;
  }
}
