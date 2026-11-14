import { createFileRoute } from "@tanstack/react-router";
import { corsHeadersFor } from "@/lib/api-base";

/**
 * Branded auth emails via Resend (instead of Supabase's built-in mailer):
 *  - signup:  creates the (unconfirmed) account and emails an 8-digit code + "Confirm my email" link
 *  - recover: emails a "Reset my password" link (always answers "sent", in constant time:
 *             no account enumeration)
 *  - welcome: one-time welcome email after the email is confirmed (needs the user's session)
 * Links point to PUBLIC_SITE_URL (our own site), never to the Supabase project domain.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMAIL_COOLDOWN_MS = 45_000; // one email per address per action
const IP_WINDOW_MS = 10 * 60_000;
const IP_MAX_SENDS = 8; // per IP per window (sign-up + reset emails)
const RECOVER_MIN_MS = 1500; // constant response time for "recover"

// Per-instance, in-memory limits (a best-effort brake; add proxy/WAF limits for scale).
const lastSent = new Map<string, number>(); // `${action}:${email}` -> time of last successful send
const ipSends = new Map<string, number[]>(); // ip -> recent send times

function prune(now: number) {
  if (lastSent.size > 5000)
    for (const [k, t] of lastSent) if (now - t > EMAIL_COOLDOWN_MS) lastSent.delete(k);
  if (ipSends.size > 5000)
    for (const [k, ts] of ipSends) if (!ts.some((t) => now - t < IP_WINDOW_MS)) ipSends.delete(k);
}
/** Seconds to wait before this address can get another email (0 = allowed). Does not record. */
function emailWait(key: string) {
  const elapsed = Date.now() - (lastSent.get(key) ?? 0);
  return elapsed < EMAIL_COOLDOWN_MS ? Math.ceil((EMAIL_COOLDOWN_MS - elapsed) / 1000) : 0;
}
function ipBlocked(ip: string) {
  const now = Date.now();
  return (ipSends.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS).length >= IP_MAX_SENDS;
}
/** Record a successful send (failed sends don't count against the user). */
function recordSend(key: string, ip: string) {
  const now = Date.now();
  lastSent.set(key, now);
  ipSends.set(ip, [...(ipSends.get(ip) ?? []).filter((t) => now - t < IP_WINDOW_MS), now]);
  prune(now);
}
function clientIp(request: Request) {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Origin used in email links. Production must set PUBLIC_SITE_URL: the request's own origin
 * comes from the client-controlled Host header, so it is only trusted for localhost (dev).
 * Otherwise a forged Host could make a real reset email link to an attacker's site.
 */
function siteUrl(request: Request): string | null {
  const fromEnv = (process.env.PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const origin = new URL(request.url);
  return /^(localhost|127\.0\.0\.1)$/.test(origin.hostname) ? origin.origin : null;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const str = (v: unknown, max = 200) => (typeof v === "string" ? v.trim().slice(0, max) : "");

type Body = Record<string, unknown>;

async function handle(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request.headers.get("origin")) ?? {};
  const json = (status: number, data: Record<string, unknown>) =>
    Response.json(data, { status, headers: cors });

  let body: Body;
  try {
    body = (await request.json()) as Body;
  } catch {
    return json(400, { error: "Invalid request." });
  }
  const action = str(body.action);
  const site = siteUrl(request);
  if (!site) {
    console.error("[auth-email] PUBLIC_SITE_URL is not set: refusing to build email links");
    return json(500, { error: "Email is not configured yet. Please try again later." });
  }
  const ip = clientIp(request);

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmail, confirmSignupEmail, resetPasswordEmail, welcomeEmail } =
      await import("@/lib/emails.server");

    if (action === "signup") {
      const email = str(body.email).toLowerCase();
      const password = typeof body.password === "string" ? body.password : "";
      // Shown in the email greeting: keep it short (limits abuse of the field for spam text).
      const fullName = str(body.fullName, 60);
      if (!EMAIL_RE.test(email)) return json(400, { error: "Enter a valid email address." });
      if (password.length < 8)
        return json(400, { error: "Password must be at least 8 characters." });
      const key = `signup:${email}`;
      const wait = emailWait(key);
      if (wait)
        return json(429, {
          status: "throttled",
          error: `A code was sent recently. Please wait ${wait}s before requesting another.`,
        });
      if (ipBlocked(ip))
        return json(429, { error: "Too many requests. Please try again in a few minutes." });

      // Only send profile fields that were actually provided: a resend from the login screen
      // has none, and sending empty/null values could wipe what the user entered at sign-up.
      const profile = Object.fromEntries(
        Object.entries({
          full_name: fullName,
          phone: str(body.phone, 20),
          state: str(body.state, 60),
          city: str(body.city, 60),
          pincode: str(body.pincode, 10),
        }).filter(([, v]) => v),
      );
      // Creates the unconfirmed user (or re-issues a code for an unconfirmed one; the stored
      // password is NOT changed by a repeat request). Confirmed emails get 422.
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email,
        password,
        ...(Object.keys(profile).length ? { options: { data: profile } } : {}),
      });
      if (error) {
        if (
          error.status === 422 ||
          /already been registered|already registered/i.test(error.message)
        ) {
          return json(409, {
            status: "exists",
            error: "An account with this email already exists.",
          });
        }
        throw error;
      }
      const { email_otp, hashed_token } = data.properties;
      const name = fullName || String(data.user?.user_metadata?.full_name ?? "");
      const link = `${site}/auth/confirm?type=signup&token_hash=${encodeURIComponent(hashed_token)}`;
      await sendEmail(confirmSignupEmail({ to: email, name, code: email_otp, link, site }));
      recordSend(key, ip);
      return json(200, { status: "sent" });
    }

    if (action === "recover") {
      const started = Date.now();
      const email = str(body.email).toLowerCase();
      if (!EMAIL_RE.test(email)) return json(400, { error: "Enter a valid email address." });
      const key = `recover:${email}`;
      // Throttled or unknown: answer exactly like a real send, after the same delay.
      if (!emailWait(key) && !ipBlocked(ip)) {
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
          type: "recovery",
          email,
        });
        if (!error && data?.properties?.hashed_token) {
          const link = `${site}/reset-password?type=recovery&token_hash=${encodeURIComponent(data.properties.hashed_token)}`;
          try {
            await sendEmail(resetPasswordEmail({ to: email, link, site }));
            recordSend(key, ip);
          } catch (err) {
            console.error(
              "[auth-email:recover] send failed:",
              err instanceof Error ? err.message : err,
            );
          }
        }
      }
      // Constant response time, so timing can't reveal whether the address has an account.
      await sleep(Math.max(0, RECOVER_MIN_MS - (Date.now() - started)));
      return json(200, { status: "sent" });
    }

    if (action === "welcome") {
      const jwt = (request.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
      if (!jwt) return json(401, { error: "Not signed in." });
      const { data, error } = await supabaseAdmin.auth.getUser(jwt);
      const user = data?.user;
      if (error || !user?.email) return json(401, { error: "Not signed in." });
      if (!user.email_confirmed_at) return json(400, { error: "Email not confirmed yet." });
      // app_metadata is not user-editable, so this "sent once" flag can't be reset by the user.
      if (user.app_metadata?.welcome_sent_at) return json(200, { status: "skipped" });
      const name = String(user.user_metadata?.full_name ?? user.user_metadata?.name ?? "");
      // Claim the flag first (avoids double sends), and release it if the send fails.
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...user.app_metadata, welcome_sent_at: new Date().toISOString() },
      });
      try {
        await sendEmail(welcomeEmail({ to: user.email, name, site }));
      } catch (err) {
        await supabaseAdmin.auth.admin.updateUserById(user.id, {
          app_metadata: { ...user.app_metadata, welcome_sent_at: null },
        });
        throw err;
      }
      return json(200, { status: "sent" });
    }

    return json(400, { error: "Unknown action." });
  } catch (err) {
    console.error(`[auth-email:${action}]`, err instanceof Error ? err.message : err);
    return json(500, {
      error: "We couldn't send the email right now. Please try again in a minute.",
    });
  }
}

export const Route = createFileRoute("/api/public/auth-email")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      OPTIONS: async ({ request }) => {
        const cors = corsHeadersFor(request.headers.get("origin"));
        return new Response(null, { status: cors ? 204 : 403, headers: cors ?? {} });
      },
    },
  },
});
