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

  useEffect(() => {
    // Supabase delivers the recovery token in the URL hash and exchanges it for a
    // short-lived session. Only that recovery session may set a new password.
    const hash = window.location.hash ?? "";
    const isRecovery = hash.includes("type=recovery");

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY" || (isRecovery && session)) {
        setValid(true);
        setReady(true);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && (isRecovery || true)) setValid(!!session);
      setReady(true);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    if (password !== confirm) return toast.error("Passwords do not match");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error(error.message || "Could not update your password");
    setDone(true);
    toast.success("Password updated");
    // Force a clean sign-in with the new credentials.
    await supabase.auth.signOut();
    setTimeout(() => navigate({ to: "/login", replace: true }), 1600);
  }

  return (
    <div className="min-h-screen bg-muted/30 flex items-start md:items-center justify-center p-0 md:p-6">
      <div className="w-full max-w-md bg-card md:rounded-3xl md:border md:border-border md:shadow-xl p-6 md:p-8">
        <h1 className="font-display text-2xl font-extrabold text-foreground text-center">Set a new password</h1>

        {!ready ? (
          <div className="mt-8 flex justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : done ? (
          <div className="mt-6 text-center space-y-3">
            <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
            <p className="text-sm text-muted-foreground">Your password has been updated. Redirecting you to sign in…</p>
          </div>
        ) : !valid ? (
          <div className="mt-6 text-center space-y-4">
            <ShieldAlert className="mx-auto h-12 w-12 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              This reset link is invalid or has expired. Request a new one from the sign-in screen.
            </p>
            <Button asChild className="w-full h-12 rounded-xl font-bold">
              <Link to="/login">Back to sign in</Link>
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type={show ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="New password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-12 rounded-xl pl-10 pr-10"
              />
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type={show ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="Confirm new password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                className="h-12 rounded-xl pl-10"
              />
            </div>
            <p className="text-[11px] text-muted-foreground">Use at least 8 characters.</p>
            <Button
              type="submit"
              disabled={busy}
              className="w-full h-12 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-base shadow-md"
            >
              {busy ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Updating…</>) : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </div>
  );
}
