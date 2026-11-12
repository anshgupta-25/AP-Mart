// Native (Android) push notifications via @capacitor/push-notifications.
//
// The Android WebView does not support web push / service workers, so inside
// the Capacitor app we register with FCM natively. Firebase config comes from
// android/app/google-services.json (not the VITE_FIREBASE_* web keys).
// Tokens are stored in the same fcm_tokens table with platform = "android".
import { Capacitor } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";
import type { PushResult } from "./messaging";

export const isNativeApp = () => Capacitor.isNativePlatform();

/**
 * True only when the mobile build found android/app/google-services.json (set in
 * vite.config.ts). Without it Firebase is not initialised natively and calling
 * PushNotifications.register() crashes the app, so push stays off.
 */
export const isNativePushConfigured = () => import.meta.env.VITE_NATIVE_PUSH === "true";

let listenersPromise: Promise<void> | null = null;
let tokenWaiters: Array<(r: PushResult) => void> = [];
let lastToken: string | null = null;
let currentUserId: string | null = null;
let navigate: ((path: string) => void) | null = null;

/** Root component registers the router so notification taps navigate in-app. */
export function setNativeNavigator(fn: ((path: string) => void) | null) {
  navigate = fn;
}

function settleWaiters(result: PushResult) {
  const waiters = tokenWaiters;
  tokenWaiters = [];
  for (const w of waiters) w(result);
}

async function storeToken(userId: string, token: string) {
  const { error } = await supabase.from("fcm_tokens").upsert(
    {
      user_id: userId,
      token,
      platform: Capacitor.getPlatform(),
      user_agent: navigator.userAgent,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "token" },
  );
  if (error) console.warn("[push] failed to store token", error.message);
}

// Attach listeners once; concurrent callers share the same promise, and a
// failed attempt can be retried.
function ensureListeners(): Promise<void> {
  listenersPromise ??= (async () => {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.addListener("registration", async ({ value }) => {
      lastToken = value;
      if (currentUserId) await storeToken(currentUserId, value);
      settleWaiters({ status: "registered", token: value });
    });
    await PushNotifications.addListener("registrationError", ({ error }) => {
      settleWaiters({ status: "error", error: String(error) });
    });
    // User tapped a notification: open the page it points to.
    await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
      const url = notification.data?.url;
      if (typeof url === "string" && url.startsWith("/")) navigate?.(url);
    });
  })().catch((e) => {
    listenersPromise = null;
    throw e;
  });
  return listenersPromise;
}

/** Ask for permission (Android 13+ shows a prompt), register with FCM and store the token. */
export async function enableNativePush(
  userId: string,
  opts?: { requestPermission?: boolean },
): Promise<PushResult> {
  if (!isNativePushConfigured()) return { status: "not-configured" };
  try {
    const { PushNotifications } = await import("@capacitor/push-notifications");
    currentUserId = userId;
    await ensureListeners();

    let perm = await PushNotifications.checkPermissions();
    if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
      if (opts?.requestPermission === false) return { status: "denied" };
      perm = await PushNotifications.requestPermissions();
    }
    if (perm.receive !== "granted") return { status: "denied" };

    const result = new Promise<PushResult>((resolve) => {
      tokenWaiters.push(resolve);
      setTimeout(
        () => resolve({ status: "error", error: "Timed out waiting for FCM token" }),
        15_000,
      );
    });
    await PushNotifications.register();
    return await result;
  } catch (e) {
    console.warn("[push] enableNativePush error", e);
    return { status: "error", error: e instanceof Error ? e.message : String(e) };
  }
}

/**
 * Logout cleanup. Call while still signed in (fcm_tokens RLS needs the session).
 * Always unregisters the device from FCM, so even if the row could not be deleted
 * the token is dead and the server prunes it on the next send.
 */
export async function disableNativePush(userId?: string) {
  currentUserId = null;
  if (!isNativePushConfigured()) return;
  try {
    if (lastToken) {
      const query = supabase.from("fcm_tokens").delete().eq("token", lastToken);
      const { error } = userId ? await query.eq("user_id", userId) : await query;
      if (error) console.warn("[push] failed to delete token", error.message);
    }
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.unregister();
  } catch (e) {
    console.warn("[push] disableNativePush error", e);
  } finally {
    lastToken = null;
  }
}

export const getNativeToken = () => lastToken;
