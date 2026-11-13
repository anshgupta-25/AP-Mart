// Server-side FCM sender.
// Called by the Postgres trigger (public.send_fcm_push) with a shared secret.
// Sends through the FCM HTTP v1 API using a Firebase service account
// (FIREBASE_SERVICE_ACCOUNT_JSON, server-only). Credentials never reach the browser.
import { createFileRoute } from "@tanstack/react-router";
import { z } from "zod";

type ServiceAccount = { client_email: string; private_key: string; project_id: string };

let cachedToken: { email: string; token: Promise<string>; expiresAt: number } | undefined;

function b64url(data: ArrayBuffer | string) {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : new Uint8Array(data);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// OAuth2 access token for FCM from a service account (JWT bearer grant, RS256).
async function getAccessToken(sa: ServiceAccount): Promise<string> {
  // Reuse an in-flight or still-valid token for the same account (avoids parallel OAuth exchanges).
  if (
    cachedToken &&
    cachedToken.email === sa.client_email &&
    cachedToken.expiresAt > Date.now() + 60_000
  ) {
    return cachedToken.token;
  }
  const token = mintAccessToken(sa);
  // Optimistic expiry; corrected once the token arrives.
  cachedToken = { email: sa.client_email, token, expiresAt: Date.now() + 3_000_000 };
  token.catch(() => {
    if (cachedToken?.token === token) cachedToken = undefined;
  });
  return token;
}

async function mintAccessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claims = b64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/firebase.messaging",
      aud: "https://oauth2.googleapis.com/token",
      iat: now,
      exp: now + 3600,
    }),
  );
  const pem = sa.private_key.replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey(
    "pkcs8",
    der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    key,
    new TextEncoder().encode(`${header}.${claims}`),
  );
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${header}.${claims}.${b64url(sig)}`,
    }),
  });
  if (!res.ok)
    throw new Error(`FCM auth failed [${res.status}]: ${(await res.text()).slice(0, 200)}`);
  const json = (await res.json()) as { access_token: string; expires_in: number };
  if (cachedToken?.email === sa.client_email)
    cachedToken.expiresAt = Date.now() + json.expires_in * 1000;
  return json.access_token;
}

function readServiceAccount(): ServiceAccount | undefined {
  const raw = process.env["FIREBASE_SERVICE_ACCOUNT_JSON"];
  if (!raw) return undefined;
  try {
    const sa = JSON.parse(raw) as ServiceAccount;
    return sa.client_email && sa.private_key && sa.project_id ? sa : undefined;
  } catch {
    return undefined;
  }
}

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

  const serviceAccount = readServiceAccount();
  if (!serviceAccount) {
    return Response.json(
      { error: "FIREBASE_SERVICE_ACCOUNT_JSON is not configured" },
      { status: 503 },
    );
  }

  const { data: notification, error: nErr } = await supabaseAdmin
    .from("notifications")
    .select("id, user_id, title, body, category, data")
    .eq("id", parsed.notification_id)
    .maybeSingle();

  if (nErr || !notification)
    return Response.json({ error: "Notification not found" }, { status: 404 });

  const { data: tokens } = await supabaseAdmin
    .from("fcm_tokens")
    .select("token")
    .eq("user_id", notification.user_id);

  if (!tokens?.length) return Response.json({ sent: 0, removed: 0, reason: "no_tokens" });

  const payloadData: Record<string, string> = {
    notification_id: notification.id,
    category: notification.category ?? "system",
  };
  const url = (notification.data as { url?: unknown } | null)?.url;
  if (typeof url === "string") payloadData["url"] = url;

  // FCM requires an absolute HTTPS click-through link; the DB stores app-relative paths.
  const { data: baseRow } = await supabaseAdmin
    .from("app_config")
    .select("value")
    .eq("key", "app_base_url")
    .maybeSingle();
  let link: string | undefined;
  if (typeof url === "string") {
    try {
      const abs = new URL(url, baseRow?.value ?? undefined);
      if (abs.protocol === "https:") link = abs.toString();
    } catch {
      // No usable base URL: send without a click-through link.
    }
  }

  let accessToken: string;
  try {
    accessToken = await getAccessToken(serviceAccount);
  } catch (e) {
    console.error("[FCM]", e);
    return Response.json({ error: "Firebase authentication failed" }, { status: 502 });
  }

  const sendUrl = `https://fcm.googleapis.com/v1/projects/${serviceAccount.project_id}/messages:send`;
  const results = await Promise.allSettled(
    tokens.map(async ({ token }) => {
      const res = await fetch(sendUrl, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: notification.title, body: notification.body ?? "" },
            data: payloadData,
            // Android app (native FCM): deliver promptly; the app opens data.url on tap.
            android: { priority: "HIGH" },
            webpush: {
              fcm_options: link ? { link } : undefined,
              notification: { icon: "/icon-192.png" },
            },
          },
        }),
      });
      return { token, status: res.status, ok: res.ok, body: res.ok ? "" : await res.text() };
    }),
  );

  let sent = 0;
  const stale: string[] = [];
  const errors: string[] = [];

  for (const r of results) {
    if (r.status === "rejected") {
      errors.push(`network: ${String(r.reason).slice(0, 200)}`);
      continue;
    }
    const { token, status, ok, body } = r.value;
    if (ok) {
      sent += 1;
      continue;
    }
    console.error(`[FCM] send failed [${status}]: ${body}`);
    errors.push(`${status}: ${body.slice(0, 300)}`);
    if (status === 401) cachedToken = undefined; // revoked/rotated credentials: re-mint next time
    // Only drop tokens FCM says are dead, never on generic INVALID_ARGUMENT (bad payload).
    if (
      status === 404 ||
      /UNREGISTERED|registration-token-not-registered|invalid-registration-token/i.test(body)
    ) {
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
