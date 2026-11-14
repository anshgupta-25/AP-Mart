import { supabase } from "@/integrations/supabase/client";
import { publicSiteOrigin } from "@/lib/api-base";

/** Maps Supabase's real error to a clear message (and logs the original). */
function describeResetError(err: { message: string; status?: number; code?: string }): string {
  const code = err.code ?? "";
  if (
    err.status === 429 ||
    code === "over_email_send_rate_limit" ||
    /rate limit/i.test(err.message)
  )
    return "Too many reset emails requested. Please wait a few minutes and try again.";
  if (code === "validation_failed" || /redirect/i.test(err.message))
    // Admin fix (see console log): add the URL under Supabase → Auth → URL Configuration.
    return "Password reset is temporarily unavailable. Please try again later or contact support.";
  if (
    err.status === 500 ||
    code === "unexpected_failure" ||
    /sending recovery email/i.test(err.message)
  )
    // Admin fix (see console log): check Supabase → Auth → SMTP settings.
    return "We couldn't send the reset email right now. Please try again in a few minutes.";
  return err.message || "Could not send the reset email.";
}

/**
 * Sends a password recovery email. The generic success message is deliberate:
 * Supabase does not reveal whether an address has an account (prevents user
 * enumeration), so unknown addresses also return success without sending.
 */
export async function requestPasswordReset(email: string): Promise<{ error: string | null }> {
  const target = email.trim();
  if (!/^\S+@\S+\.\S+$/.test(target)) return { error: "Enter a valid email address." };
  const redirectTo = `${publicSiteOrigin()}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(target, { redirectTo });
  if (error) {
    console.error("[PasswordReset] resetPasswordForEmail failed:", {
      message: error.message,
      status: error.status,
      code: (error as { code?: string }).code,
      redirectTo,
    });
    return { error: describeResetError(error as never) };
  }
  return { error: null };
}
