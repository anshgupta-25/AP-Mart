/** Turn Supabase Auth errors into messages a customer can act on (no tokens/passwords logged). */
export function describeAuthError(
  error: { message?: string; status?: number; code?: string } | null | undefined,
): string {
  if (!error) return "Something went wrong. Please try again.";
  const msg = String(error.message ?? "");
  const code = String(error.code ?? "");
  const status = Number(error.status ?? 0);

  if (code === "invalid_credentials" || /invalid login credentials/i.test(msg))
    return "Invalid email or password.";
  if (code === "email_not_confirmed" || /email not confirmed/i.test(msg))
    return "Email confirmation required. Please open the confirmation link we emailed you, then sign in.";
  if (code === "user_already_exists" || /already (been )?registered|already exists/i.test(msg))
    return "This email is already registered. Try signing in instead.";
  if (
    /error sending (confirmation|recovery|magic link|email)/i.test(msg) ||
    code === "unexpected_failure"
  )
    return "Your account could not be created because the confirmation email could not be delivered. Please try again later or contact support.";
  if (code === "over_email_send_rate_limit" || /email rate limit/i.test(msg))
    return "Too many emails were requested. Please wait a few minutes and try again.";
  if (code === "over_request_rate_limit" || status === 429)
    return "Too many attempts. Please wait a moment and try again.";
  if (code === "weak_password" || /password.*(short|weak|least)/i.test(msg))
    return "Password is too weak. Use at least 6 characters (a mix of letters and numbers is best).";
  if (code === "validation_failed" || /unable to validate email|invalid.*email/i.test(msg))
    return "Please enter a valid email address.";
  if (code === "signup_disabled") return "Sign-ups are currently disabled.";
  if (/failed to fetch|network|load failed/i.test(msg) || status === 0)
    return "Network error. Check your connection and try again.";
  if (status >= 500) return "Server error. Please try again in a moment.";
  return msg || "Something went wrong. Please try again.";
}
