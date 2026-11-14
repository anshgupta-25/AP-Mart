import { supabase } from "@/integrations/supabase/client";
import { toApiUrl } from "@/lib/api-base";

/** Client side of /api/public/auth-email (branded sign-up code, reset link, welcome mail). */

export type SignupDetails = {
  email: string;
  password: string;
  fullName: string;
  phone?: string;
  state?: string | null;
  city?: string | null;
  pincode?: string | null;
};

type ApiResult = { status?: string; error?: string };

async function call(
  body: Record<string, unknown>,
  token?: string,
): Promise<ApiResult & { httpStatus: number }> {
  try {
    const res = await fetch(toApiUrl("/api/public/auth-email"), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
    const data = (await res.json().catch(() => ({}))) as ApiResult;
    return { ...data, httpStatus: res.status };
  } catch {
    return { error: "Network error. Check your connection and try again.", httpStatus: 0 };
  }
}

/** Creates the account (unconfirmed) and emails the 8-digit code + confirm link. */
export async function requestSignupCode(d: SignupDetails) {
  const r = await call({ action: "signup", ...d });
  if (r.status === "exists") return { exists: true as const, error: null };
  return {
    exists: false as const,
    error: r.httpStatus === 200 ? null : (r.error ?? "Could not send the code."),
  };
}

/** Emails a reset link. Succeeds for unknown addresses too (no account enumeration). */
export async function requestPasswordReset(email: string) {
  const target = email.trim();
  if (!/^\S+@\S+\.\S+$/.test(target)) return { error: "Enter a valid email address." };
  const r = await call({ action: "recover", email: target });
  return { error: r.httpStatus === 200 ? null : (r.error ?? "Could not send the email.") };
}

/** Best effort: the server sends the welcome email once per account. */
export async function sendWelcomeEmail() {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (token) await call({ action: "welcome" }, token);
}

/**
 * Verifies the emailed code. On success the user is signed in; the password typed in this
 * session is (re)applied so the person who owns the inbox decides the password (closes the
 * "someone pre-registered my email" gap), then the welcome email goes out.
 */
export async function verifySignupCode(email: string, code: string, password?: string) {
  const { error } = await supabase.auth.verifyOtp({
    email: email.trim(),
    token: code.trim(),
    type: "email",
  });
  if (error) {
    return {
      error: /expired|invalid/i.test(error.message)
        ? "That code is incorrect or has expired. Check the latest email or send a new code."
        : error.message,
    };
  }
  if (password) await supabase.auth.updateUser({ password });
  void sendWelcomeEmail();
  return { error: null };
}
