import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { MailCheck, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { supabase } from "@/integrations/supabase/client";
import { sendWelcomeEmail } from "@/lib/authEmail";

export const Route = createFileRoute("/auth/confirm")({
  head: () => ({ meta: [{ title: "Confirm your email — AP Mart" }] }),
  component: ConfirmEmailPage,
});

/**
 * "Confirm my email" link from the sign-up email (?type=signup&token_hash=…).
 * The user sets their password and the email is confirmed in the same step (the one-time
 * token is redeemed only on submit). Whoever owns the inbox therefore decides the password,
 * and closing the page early leaves nothing confirmed: an account someone else pre-registered
 * with this email can't end up confirmed with their password.
 */
function ConfirmEmailPage() {
  const navigate = useNavigate();
  const tokenHash = useRef<string | null>(null);
  const verified = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (tokenHash.current !== null) return;
    const params = new URLSearchParams(window.location.search);
    tokenHash.current = params.get("token_hash") ?? "";
    window.history.replaceState(null, "", window.location.pathname); // keep the token out of history
    if (!tokenHash.current)
      setError("This confirmation link is incomplete. Open it again from the email.");
  }, []);

  // Runs when the user submits their password: confirm the email first (once).
  const confirmEmail = async (): Promise<string | null> => {
    if (verified.current) return null;
    const { error: verifyError } = await supabase.auth.verifyOtp({
      token_hash: tokenHash.current ?? "",
      type: "signup",
    });
    if (verifyError) {
      setError(
        /expired/i.test(verifyError.message)
          ? "This link has expired. Sign up again with the same email to get a new code."
          : "This link is invalid or has already been used. If you already confirmed your email, just log in.",
      );
      return "Couldn't confirm your email.";
    }
    verified.current = true;
    return null;
  };

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 pb-10 pt-safe md:items-center">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 mt-6 flex justify-center">
          <Logo size="md" />
        </Link>

        {error ? (
          <div className="space-y-4 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-warning-foreground" />
            <h1 className="large-title">Couldn't confirm</h1>
            <p className="text-meta text-muted-foreground">{error}</p>
            <Button asChild className="h-11 w-full rounded-xl">
              <Link to="/login">Go to log in</Link>
            </Button>
            <Link to="/signup" className="block text-meta font-medium text-muted-foreground">
              Sign up again
            </Link>
          </div>
        ) : (
          <>
            <div className="text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-primary-soft text-primary-ink">
                <MailCheck className="h-6 w-6" strokeWidth={1.8} />
              </div>
              <h1 className="large-title mt-4">Confirm your email</h1>
              <p className="mt-1 text-meta text-muted-foreground">
                Set your password to confirm your email and finish creating your account.
              </p>
            </div>
            <div className="mt-6 rounded-xl border border-border/70 bg-card p-5">
              <NewPasswordForm
                submitLabel="Confirm & finish"
                beforeSave={confirmEmail}
                onSaved={() => {
                  void sendWelcomeEmail();
                  navigate({ to: "/auth/callback", replace: true });
                }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}
