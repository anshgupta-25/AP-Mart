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

let listenersReady = false;
let tokenWaiter: ((r: PushResult) => void) | null = null;
let lastToken: string | null = null;
let currentUserId: string | null = null;

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

// Open an in-app path without reloading the app (TanStack Router listens to popstate).
function openInApp(url: unknown) {
  if (typeof url !== "string" || !url.startsWith("/")) return;
  window.history.pushState({}, "", url);
  window.dispatchEvent(new PopStateEvent("popstate"));
}

async function ensureListeners() {
  if (listenersReady) return;
  listenersReady = true;
  const { PushNotifications } = await import("@capacitor/push-notifications");

  await PushNotifications.addListener("registration", async ({ value }) => {
    lastToken = value;
    if (currentUserId) await storeToken(currentUserId, value);
    tokenWaiter?.({ status: "registered", token: value });
    tokenWaiter = null;
  });
  await PushNotifications.addListener("registrationError", ({ error }) => {
    tokenWaiter?.({ status: "error", error: String(error) });
    tokenWaiter = null;
  });
  // User tapped a notification: open the page it points to.
  await PushNotifications.addListener("pushNotificationActionPerformed", ({ notification }) => {
    openInApp(notification.data?.url);
  });
}

/** Ask for permission (Android 13+ shows a prompt), register with FCM and store the token. */
export async function enableNativePush(
  userId: string,
  opts?: { requestPermission?: boolean },
): Promise<PushResult> {
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
      tokenWaiter = resolve;
      setTimeout(
        () => resolve({ status: "error", error: "Timed out waiting for FCM token" }),
        15_000,
      );
    });
    await PushNotifications.register();
    return await result;
  } catch (e: any) {
    console.warn("[push] enableNativePush error", e);
    return { status: "error", error: String(e?.message ?? e) };
  }
}

/** Remove this device's token on logout. */
export async function disableNativePush(userId?: string) {
  try {
    currentUserId = null;
    if (!lastToken) return;
    const query = supabase.from("fcm_tokens").delete().eq("token", lastToken);
    if (userId) await query.eq("user_id", userId);
    else await query;
    const { PushNotifications } = await import("@capacitor/push-notifications");
    await PushNotifications.unregister();
    lastToken = null;
  } catch (e) {
    console.warn("[push] disableNativePush error", e);
  }
}

export const getNativeToken = () => lastToken;
