import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NewPasswordForm } from "@/components/auth/NewPasswordForm";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset your password — AP Mart" },
      { name: "description", content: "Choose a new password for your AP Mart account." },
      { property: "og:title", content: "Reset your password — AP Mart" },
      { property: "og:description", content: "Choose a new password for your AP Mart account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [valid, setValid] = useState(false);
  const [done, setDone] = useState(false);

  const [linkError, setLinkError] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    // Supabase puts either a recovery token (type=recovery) or an error
    // (error_code=otp_expired, access_denied…) in the URL hash/query.
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const get = (k: string) => hash.get(k) ?? params.get(k);
    // Our branded reset email links here with ?type=recovery&token_hash=… (one-time).
    const tokenHash = params.get("token_hash");
    if (tokenHash && params.get("type") === "recovery") {
      // Remove the token from the address bar so a refresh can't try to reuse it.
      window.history.replaceState(null, "", window.location.pathname);
      void supabase.auth
        .verifyOtp({ token_hash: tokenHash, type: "recovery" })
        .then(async ({ error }) => {
          if (error) {
            console.error("[ResetPassword] verifyOtp failed:", error.message);
            setLinkError(
              /expired/i.test(error.message)
                ? "This reset link has expired. Request a new one below."
                : "This reset link is invalid or has already been used. Request a new one below.",
            );
            setReady(true);
            return;
          }
          const { data } = await supabase.auth.getUser();
          setEmail(data.user?.email ?? null);
          setValid(true);
          setReady(true);
        });
      return;
    }

    const errCode = get("error_code") ?? get("error");
    if (errCode) {
      const expired = /expired|otp_expired/i.test(`${errCode} ${get("error_description") ?? ""}`);
      console.error("[ResetPassword] recovery link error:", errCode, get("error_description"));
      setLinkError(
        expired
          ? "This reset link has expired. Request a new one from the sign-in screen."
          : "This reset link is invalid or has already been used. Request a new one.",
      );
      setReady(true);
      return;
    }

    let settled = false;
    const accept = () => {
      settled = true;
      setValid(true);
      setReady(true);
    };

    // The Supabase client consumes the link (hash token or ?code=) on its own and
    // emits PASSWORD_RECOVERY. That can happen before this page mounts, so also
    // accept the recovery session it already created.
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") accept();
    });

    const check = async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) {
        setEmail(data.session.user.email ?? null);
        accept();
      }
    };
    void check();

    // No session after the client has had time to process the link → invalid link.
    const timer = window.setTimeout(async () => {
      if (settled) return;
      await check();
      if (!settled) setReady(true);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
      subscription.unsubscribe();
    };
  }, []);

  async function onSaved() {
    setDone(true);
    toast.success("Password updated. Please log in with your new password.");
    // Force a clean sign-in with the new credentials.
    await supabase.auth.signOut();
    setTimeout(() => navigate({ to: "/login", replace: true }), 1600);
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 pb-10 pt-safe md:items-center">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 mt-6 flex justify-center">
          <Logo size="md" />
        </Link>
        {!ready ? (
          <div className="mt-10 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : done ? (
          <div className="space-y-3 text-center">
            <CheckCircle2 className="mx-auto h-10 w-10 text-primary" />
            <h1 className="large-title">Password updated</h1>
            <p className="text-meta text-muted-foreground">Taking you to log in…</p>
          </div>
        ) : !valid ? (
          <div className="space-y-4 text-center">
            <ShieldAlert className="mx-auto h-10 w-10 text-warning-foreground" />
            <h1 className="large-title">Link not valid</h1>
            <p className="text-meta text-muted-foreground">
              {linkError ?? "This reset link is invalid or has expired. Request a new one below."}
            </p>
            <Button asChild className="h-11 w-full rounded-xl">
              <Link to="/forgot-password">Request a new link</Link>
            </Button>
            <Link to="/login" className="block text-meta font-medium text-muted-foreground">
              Back to log in
            </Link>
          </div>
        ) : (
          <>
            <h1 className="large-title text-center">Choose a new password</h1>
            <p className="mt-1 text-center text-meta text-muted-foreground">
              {email ? (
                <>
                  Signed in as <span className="font-semibold text-foreground">{email}</span>.{" "}
                </>
              ) : null}
              Pick something you haven't used before.
            </p>
            <div className="mt-6 rounded-xl border border-border/70 bg-card p-5">
              <NewPasswordForm submitLabel="Save new password" onSaved={onSaved} />
            </div>
            <p className="mt-4 text-center text-small text-muted-foreground">
              You'll log in again with your new password once it's saved.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
