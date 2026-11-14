import { createFileRoute } from "@tanstack/react-router";
import { corsHeadersFor } from "@/lib/api-base";

/**
 * Branded auth emails via Resend (instead of Supabase's built-in mailer):
 *  - signup:  creates the (unconfirmed) account and emails an 8-digit code + "Confirm my email" link
 *  - recover: emails a "Reset my password" link (always answers "sent": no account enumeration)
 *  - welcome: one-time welcome email after the email is confirmed (needs the user's session)
 * Links point to our own site (PUBLIC_SITE_URL), never to the Supabase project domain.
 */

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const COOLDOWN_MS = 45_000;
const lastSent = new Map<string, number>(); // per-instance throttle: action:email -> time

function throttled(key: string) {
  const now = Date.now();
  const prev = lastSent.get(key) ?? 0;
  if (now - prev < COOLDOWN_MS) return Math.ceil((COOLDOWN_MS - (now - prev)) / 1000);
  lastSent.set(key, now);
  if (lastSent.size > 5000) lastSent.clear();
  return 0;
}

/** Origin used in email links. Never taken from client-controlled headers. */
function siteUrl(request: Request) {
  const fromEnv = (process.env.PUBLIC_SITE_URL || process.env.VITE_PUBLIC_SITE_URL || "").trim();
  return (fromEnv || new URL(request.url).origin).replace(/\/+$/, "");
}

type Body = {
  action?: unknown;
  email?: unknown;
  password?: unknown;
  fullName?: unknown;
  phone?: unknown;
  state?: unknown;
  city?: unknown;
  pincode?: unknown;
};
const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");

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

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmail, confirmSignupEmail, resetPasswordEmail, welcomeEmail } =
      await import("@/lib/emails.server");

    if (action === "signup") {
      const email = str(body.email).toLowerCase();
      const password = typeof body.password === "string" ? body.password : "";
      const fullName = str(body.fullName);
      if (!EMAIL_RE.test(email)) return json(400, { error: "Enter a valid email address." });
      if (password.length < 8)
        return json(400, { error: "Password must be at least 8 characters." });
      const wait = throttled(`signup:${email}`);
      if (wait) return json(429, { error: `Please wait ${wait}s before requesting another code.` });

      // Creates the unconfirmed user (or re-issues a code for an unconfirmed one; the stored
      // password is NOT changed by a repeat request). Confirmed emails get 422.
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "signup",
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            phone: str(body.phone) || null,
            state: str(body.state) || null,
            city: str(body.city) || null,
            pincode: str(body.pincode) || null,
          },
        },
      });
      if (error) {
        if (
          error.status === 422 ||
          /already been registered|already registered/i.test(error.message)
        ) {
          lastSent.delete(`signup:${email}`);
          return json(409, {
            status: "exists",
            error: "An account with this email already exists.",
          });
        }
        throw error;
      }
      const { email_otp, hashed_token } = data.properties;
      const link = `${site}/auth/confirm?type=signup&token_hash=${encodeURIComponent(hashed_token)}`;
      await sendEmail(
        confirmSignupEmail({ to: email, name: fullName, code: email_otp, link, site }),
      );
      return json(200, { status: "sent" });
    }

    if (action === "recover") {
      const email = str(body.email).toLowerCase();
      if (!EMAIL_RE.test(email)) return json(400, { error: "Enter a valid email address." });
      const wait = throttled(`recover:${email}`);
      if (wait)
        return json(429, { error: `Please wait ${wait}s before requesting another email.` });
      const { data, error } = await supabaseAdmin.auth.admin.generateLink({
        type: "recovery",
        email,
      });
      // Unknown address: answer exactly like a known one (no account enumeration).
      if (!error && data?.properties?.hashed_token) {
        const link = `${site}/reset-password?type=recovery&token_hash=${encodeURIComponent(data.properties.hashed_token)}`;
        // A send failure must look the same as an unknown address (else it reveals accounts).
        await sendEmail(resetPasswordEmail({ to: email, link, site })).catch((err) =>
          console.error(
            "[auth-email:recover] send failed:",
            err instanceof Error ? err.message : err,
          ),
        );
      }
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
      await supabaseAdmin.auth.admin.updateUserById(user.id, {
        app_metadata: { ...user.app_metadata, welcome_sent_at: new Date().toISOString() },
      });
      await sendEmail(welcomeEmail({ to: user.email, name, site }));
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
