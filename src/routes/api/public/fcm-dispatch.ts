// Server-side FCM sender.
// Called by the Postgres trigger (public.send_fcm_push) with a shared secret.
// Firebase service-account credentials never reach the browser: the request is
// signed by the Lovable connector gateway.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

const GATEWAY_URL = "https://connector-gateway.lovable.dev/firebase_messaging";

const bodySchema = z.object({ notification_id: z.string().uuid() });

function timingSafeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function handler({ request }: { request: Request }) {
  const raw = await request.text();
  let parsed: z.infer<typeof bodySchema>;
  try {
    parsed = bodySchema.parse(JSON.parse(raw));
  } catch {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }

  const provided = request.headers.get("x-dispatch-secret") ?? "";
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  const { data: secretRow } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", "fcm_dispatch_secret")
    .maybeSingle();

  const expected = secretRow?.value ?? "";
  if (!expected || !provided || !timingSafeEqual(provided, expected)) {
    return new Response("Unauthorized", { status: 401 });
  }

  const lovableKey = process.env["LOVABLE_API_KEY"];
  const connectionKey = process.env["FIREBASE_MESSAGING_API_KEY"];
  if (!lovableKey || !connectionKey) {
    return Response.json({ error: "Firebase Messaging connection is not configured" }, { status: 503 });
  }

  const { data: notification, error: nErr } = await supabaseAdmin
    .from("notifications")
    .select("id, user_id, title, body, category, data")
    .eq("id", parsed.notification_id)
    .maybeSingle();

  if (nErr || !notification) return Response.json({ error: "Notification not found" }, { status: 404 });

  const { data: tokens } = await supabaseAdmin
    .from("fcm_tokens")
    .select("token")
    .eq("user_id", notification.user_id);

  if (!tokens?.length) return Response.json({ sent: 0, removed: 0, reason: "no_tokens" });

  const payloadData: Record<string, string> = {
    notification_id: notification.id,
    category: notification.category ?? "system",
  };
  const url = (notification.data as any)?.url;
  if (typeof url === "string") payloadData["url"] = url;

  let sent = 0;
  const stale: string[] = [];
  const errors: string[] = [];

  for (const { token } of tokens) {
    const res = await fetch(`${GATEWAY_URL}/v1/projects/_/messages:send`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${lovableKey}`,
        "X-Connection-Api-Key": connectionKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: {
          token,
          notification: { title: notification.title, body: notification.body ?? "" },
          data: payloadData,
          webpush: {
            fcm_options: url ? { link: url } : undefined,
            notification: { icon: "/icon-192.png" },
          },
        },
      }),
    });

    if (res.ok) {
      sent += 1;
      continue;
    }

    const errorBody = await res.text();
    console.error(`[FCM] send failed [${res.status}]: ${errorBody}`);
    errors.push(`${res.status}: ${errorBody.slice(0, 300)}`);
    // Stale device token — drop it so we stop retrying it.
    if (res.status === 404 || (res.status === 400 && /registration-token|INVALID_ARGUMENT/i.test(errorBody))) {
      stale.push(token);
    }
  }

  if (stale.length) {
    await supabaseAdmin.from("fcm_tokens").delete().in("token", stale);
  }

  await supabaseAdmin.from("notification_dispatch_log").insert({
    notification_id: notification.id,
    user_id: notification.user_id,
    status: sent > 0 ? "delivered" : "error",
    attempts: tokens.length,
    error: errors.length ? errors.join(" | ").slice(0, 1000) : null,
  });

  return Response.json({ sent, removed: stale.length, errors });
}

export const Route = createFileRoute("/api/public/fcm-dispatch")({
  server: { handlers: { POST: handler } },
});
