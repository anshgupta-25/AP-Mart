import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Lock, Loader2, CheckCircle2, ShieldAlert } from "lucide-react";
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
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  const [linkError, setLinkError] = useState<string | null>(null);

  useEffect(() => {
    // Supabase puts either a recovery token (type=recovery) or an error
    // (error_code=otp_expired, access_denied…) in the URL hash/query.
    const params = new URLSearchParams(window.location.search);
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const get = (k: string) => hash.get(k) ?? params.get(k);
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
      if (data.session) accept();
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      console.error("[ResetPassword] updateUser failed:", error.message);
      return toast.error(error.message || "Could not update your password");
    }
    setDone(true);
    toast.success("Password updated");
    // Force a clean sign-in with the new credentials.
    await supabase.auth.signOut();
    setTimeout(() => navigate({ to: "/login", replace: true }), 1600);
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 pb-10 pt-safe md:items-center">
      <div className="w-full max-w-md pt-12 md:pt-0">
        <h1 className="large-title text-center">Set a new password</h1>
        <div className="mt-6 rounded-xl border border-border/70 bg-card p-4 md:p-6">
          {!ready ? (
            <div className="mt-8 flex justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : done ? (
            <div className="mt-6 text-center space-y-3">
              <CheckCircle2 className="mx-auto h-9 w-9 text-primary" />
              <p className="text-sm text-muted-foreground">
                Your password has been updated. Redirecting you to sign in…
              </p>
            </div>
          ) : !valid ? (
            <div className="mt-6 text-center space-y-4">
              <ShieldAlert className="mx-auto h-9 w-9 text-warning-foreground" />
              <p className="text-sm text-muted-foreground">
                {linkError ??
                  "This reset link is invalid or has expired. Request a new one from the sign-in screen."}
              </p>
              <Button asChild className="h-11 w-full rounded-xl">
                <Link to="/login">Back to sign in</Link>
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-3">
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={show ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="New password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-11 pl-11 pr-11"
                />
                <button
                  type="button"
                  aria-label={show ? "Hide password" : "Show password"}
                  onClick={() => setShow((v) => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={show ? "text" : "password"}
                  required
                  autoComplete="new-password"
                  placeholder="Confirm new password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="h-11 pl-11"
                />
              </div>
              <p className="text-caption text-muted-foreground">Use at least 8 characters.</p>
              <Button type="submit" disabled={busy} className="h-11 w-full rounded-xl">
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating…
                  </>
                ) : (
                  "Update password"
                )}
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
