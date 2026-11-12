import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Lock, Mail, Loader2, ShieldCheck } from "lucide-react";
import { useAuth, homeForRoles } from "@/hooks/useAuth";
import { PhoneOtpForm } from "@/components/PhoneOtpForm";
import { supabase } from "@/integrations/supabase/client";
import { signInWithGoogle } from "@/lib/googleAuth";
import { toast } from "sonner";
import { describeAuthError } from "@/lib/authErrors";
import { LogoMark } from "@/components/Logo";
import { DevLoginPanel } from "@/components/DevLoginPanel";
import { cn } from "@/lib/utils";
import { publicSiteOrigin } from "@/lib/api-base";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { next?: string } =>
    typeof search.next === "string" && search.next.startsWith("/")
      ? { next: search.next }
      : {},

  head: () => ({ meta: [{ title: "Sign in — AP Mart" }] }),
  component: LoginPage,
});

type Tab = "password" | "otp";

function LoginPage() {
  const [tab, setTab] = useState<Tab>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const { signIn } = useAuth();
  const navigate = useNavigate();
  const { next } = Route.useSearch();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("flashbasket.auth");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.email) setEmail(parsed.email);
      }
    } catch {}
  }, []);

  async function routeAfterLogin(): Promise<boolean> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
    const roles = (data ?? []).map((r: any) => r.role);
    // Everyone signs in here; each role lands on its own dashboard (customers honour ?next=).
    const isCustomerOnly = !roles.some((r: string) => r !== "customer");
    if (!isCustomerOnly) {
      navigate({ to: homeForRoles(roles) as any, replace: true });
      return true;
    }
    navigate({ to: (next ?? "/customer/dashboard") as any, replace: true });
    return true;
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password, remember);
    if (error) {
      setSubmitting(false);
      toast.error(describeAuthError(error));
      return;
    }
    const ok = await routeAfterLogin();
    setSubmitting(false);
    if (!ok) return;
    try {
      if (remember) localStorage.setItem("flashbasket.auth", JSON.stringify({ email }));
      else localStorage.removeItem("flashbasket.auth");
    } catch {}
    toast.success("Welcome back");
  }

  async function handleGoogle() {
    setGoogleLoading(true);
    try {
      if (next) {
        sessionStorage.setItem("flashbasket.auth.next", next);
      }
      const result = await signInWithGoogle("/auth/callback");
      if (result.error) {
        setGoogleLoading(false);
        return toast.error(result.error.message || "Google sign-in failed");
      }
      // Web: the page navigates away to Google. App: the sign-in browser has
      // closed (deep link handles success), so re-enable the button.
      if (!result.redirected) setGoogleLoading(false);
    } catch (err: any) {
      setGoogleLoading(false);
      toast.error(err?.message || "Google sign-in failed");
    }
  }

  async function handleForgot() {
    const target = email || window.prompt("Enter your email to receive a reset link") || "";
    if (!target) return;
    const { error } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: publicSiteOrigin() + "/reset-password",
    });
    if (error) toast.error(error.message);
    else toast.success("Password reset link sent — check your inbox");
  }


  return (
    <div className="min-h-screen bg-muted/30 flex items-start md:items-center justify-center p-0 md:p-6">
      <div className="w-full max-w-md bg-card md:rounded-3xl md:border md:border-border md:shadow-xl overflow-hidden">
        {/* Header with staff portal link */}
        <div className="flex items-center justify-end px-4 pt-3">
          <Link
            to="/staff-login"
            className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:border-primary/40 transition"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Staff Login
          </Link>
        </div>

        {/* Hero */}
        <div className="relative h-36 md:h-44 overflow-hidden mt-2" style={{ background: "linear-gradient(135deg, #bbf7d0 0%, #86efac 60%, #4ade80 100%)" }}>
          <svg viewBox="0 0 400 200" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
            <g fill="rgba(255,255,255,0.18)">
              <ellipse cx="60" cy="40" rx="22" ry="6" />
              <ellipse cx="320" cy="32" rx="28" ry="7" />
              <ellipse cx="350" cy="60" rx="18" ry="5" />
            </g>
            <g transform="translate(160,30)">
              <rect x="0" y="0" width="78" height="140" rx="14" fill="#ffffff" stroke="#0e3b2a" strokeWidth="2" />
              <rect x="6" y="14" width="66" height="118" rx="6" fill="#f8fafc" />
              <path d="M20 110 Q 38 60 60 30" stroke="#16a34a" strokeWidth="2.5" strokeDasharray="4 4" fill="none" />
              <circle cx="60" cy="30" r="6" fill="#16a34a" />
            </g>
          </svg>
        </div>

        <div className="p-6 md:p-8 -mt-3 bg-card rounded-t-3xl relative">
          <div className="text-center">
            <div className="flex justify-center mb-3"><LogoMark size="lg" className="rounded-2xl" /></div>
            <h1 className="font-display text-2xl font-extrabold text-foreground">Welcome to AP Mart</h1>
            <p className="mt-1 text-sm text-muted-foreground">Groceries delivered at lightning speed</p>
          </div>

          {/* Tabs */}
          <div className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-muted p-1">
            <button
              type="button"
              onClick={() => setTab("password")}
              className={cn("h-9 rounded-lg text-xs font-bold transition", tab === "password" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}
            >
              Email & Password
            </button>
            <button
              type="button"
              onClick={() => setTab("otp")}
              className={cn("h-9 rounded-lg text-xs font-bold transition", tab === "otp" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground")}
            >
              Phone OTP
            </button>
          </div>

          {tab === "password" ? (
            <form onSubmit={handlePassword} className="mt-5 space-y-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input type="email" required placeholder="Enter your email" value={email} onChange={(e) => setEmail(e.target.value)} className="h-12 rounded-xl pl-10" />
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type={show ? "text" : "password"}
                  required
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="h-12 rounded-xl pl-10 pr-10"
                />
                <button type="button" aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                  <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                  Remember me
                </label>
                <button type="button" onClick={handleForgot} className="text-xs font-bold text-primary hover:underline">
                  Forgot Password?
                </button>
              </div>

              <Button type="submit" disabled={submitting} className="w-full h-12 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-base shadow-md">
                {submitting ? (<><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</>) : "Login"}
              </Button>
            </form>
          ) : (
            <div className="mt-5">
              <PhoneOtpForm remember={remember} onSuccess={async () => { await routeAfterLogin(); }} />
              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                We'll text a 6-digit code to your mobile number.
              </p>
            </div>
          )}


          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">or</span></div>
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={handleGoogle}
            disabled={submitting || googleLoading}
            className="w-full h-11 rounded-xl font-bold gap-2"
          >
            {googleLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                Connecting to Google…
              </>
            ) : (
              <>
                <GoogleIcon /> Continue with Google
              </>
            )}
          </Button>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Don't have an account?{" "}
            <Link to="/signup" className="font-bold text-primary hover:underline">Sign up</Link>
          </p>
          {import.meta.env.DEV && <DevLoginPanel />}
        </div>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path fill="#EA4335" d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.4 12 2.4 6.7 2.4 2.5 6.6 2.5 12s4.2 9.6 9.5 9.6c5.5 0 9.1-3.8 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z" />
    </svg>
  );
}
