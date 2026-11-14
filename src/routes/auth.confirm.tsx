import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2, ShieldAlert } from "lucide-react";
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
 * After confirming, the user sets their password here: whoever owns the inbox decides the
 * password, so an account someone else pre-registered with this email can't keep their password.
 */
function ConfirmEmailPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<"checking" | "set-password" | "error">("checking");
  const [error, setError] = useState("");
  const [email, setEmail] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    window.history.replaceState(null, "", window.location.pathname); // one-time token: drop from URL
    if (!tokenHash) {
      setError("This confirmation link is incomplete. Open it again from the email.");
      setState("error");
      return;
    }
    void supabase.auth
      .verifyOtp({ token_hash: tokenHash, type: "signup" })
      .then(async ({ error }) => {
        if (error) {
          setError(
            /expired/i.test(error.message)
              ? "This link has expired. Sign up again with the same email to get a new code."
              : "This link is invalid or has already been used. If you already confirmed your email, just log in.",
          );
          setState("error");
          return;
        }
        const { data } = await supabase.auth.getUser();
        setEmail(data.user?.email ?? null);
        setState("set-password");
      });
  }, []);

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 pb-10 pt-safe md:items-center">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 mt-6 flex justify-center">
          <Logo size="md" />
        </Link>

        {state === "checking" && (
          <div className="mt-10 flex flex-col items-center gap-3 text-meta text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin" />
            Confirming your email…
          </div>
        )}

        {state === "error" && (
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
        )}

        {state === "set-password" && (
          <>
            <div className="text-center">
              <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
              <h1 className="large-title mt-3">Email confirmed</h1>
              <p className="mt-1 text-meta text-muted-foreground">
                {email ? (
                  <>
                    <span className="font-semibold text-foreground">{email}</span> is verified.{" "}
                  </>
                ) : null}
                Set your password to finish. You'll use it to log in.
              </p>
            </div>
            <div className="mt-6 rounded-xl border border-border/70 bg-card p-5">
              <NewPasswordForm
                submitLabel="Finish setting up"
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
