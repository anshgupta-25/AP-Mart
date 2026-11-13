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
    typeof search.next === "string" && search.next.startsWith("/") ? { next: search.next } : {},

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
    } catch {
      // Best effort: storage may be unavailable or the step is optional.
    }
  }, []);

  async function routeAfterLogin(): Promise<boolean> {
    const {
      data: { user },
    } = await supabase.auth.getUser();
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
    } catch {
      // Best effort: storage may be unavailable or the step is optional.
    }
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
    <div className="flex min-h-screen items-start justify-center bg-background px-4 pb-10 pt-safe md:items-center">
      <div className="w-full max-w-md">
        <div className="flex justify-end pt-4">
          <Link
            to="/staff-login"
            className="press inline-flex h-9 items-center gap-1.5 rounded-full bg-secondary px-4 text-meta font-medium text-muted-foreground"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Staff login
          </Link>
        </div>

        <div className="mt-4 text-center">
          <div className="flex justify-center">
            <LogoMark size="lg" className="h-12 w-12 rounded-xl" />
          </div>
          <h1 className="large-title mt-3">Welcome back</h1>
          <p className="mt-1 text-meta text-muted-foreground">
            Sign in to order from shops near you
          </p>
        </div>

        <div className="mt-6 rounded-xl border border-border/70 bg-card p-4 md:p-6">
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-secondary p-1">
            <button
              type="button"
              onClick={() => setTab("password")}
              className={cn(
                "h-9 rounded-lg text-meta font-semibold transition",
                tab === "password"
                  ? "bg-card text-foreground shadow-soft"
                  : "text-muted-foreground",
              )}
            >
              Email
            </button>
            <button
              type="button"
              onClick={() => setTab("otp")}
              className={cn(
                "h-9 rounded-lg text-meta font-semibold transition",
                tab === "otp" ? "bg-card text-foreground shadow-soft" : "text-muted-foreground",
              )}
            >
              Phone OTP
            </button>
          </div>

          {tab === "password" ? (
            <form onSubmit={handlePassword} className="mt-5 space-y-3">
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type="email"
                  required
                  placeholder="Email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-11 pl-11"
                />
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  type={show ? "text" : "password"}
                  required
                  placeholder="Password"
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

              <div className="flex items-center justify-between py-1">
                <label className="flex cursor-pointer items-center gap-2 text-meta text-muted-foreground">
                  <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                  Remember me
                </label>
                <button
                  type="button"
                  onClick={handleForgot}
                  className="text-meta font-semibold text-primary"
                >
                  Forgot password?
                </button>
              </div>

              <Button type="submit" disabled={submitting} className="h-11 w-full rounded-xl">
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Signing in…
                  </>
                ) : (
                  "Log in"
                )}
              </Button>
            </form>
          ) : (
            <div className="mt-5">
              <PhoneOtpForm
                remember={remember}
                onSuccess={async () => {
                  await routeAfterLogin();
                }}
              />
              <p className="mt-3 text-center text-small text-muted-foreground">
                We'll text a 6-digit code to your mobile number.
              </p>
            </div>
          )}

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-border/70" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-card px-3 text-small text-muted-foreground">or</span>
            </div>
          </div>

          <Button
            type="button"
            variant="secondary"
            onClick={handleGoogle}
            disabled={submitting || googleLoading}
            className="h-11 w-full gap-2 rounded-xl"
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
        </div>

        <p className="mt-5 text-center text-meta text-muted-foreground">
          New to AP Mart?{" "}
          <Link to="/signup" className="font-semibold text-primary">
            Create account
          </Link>
        </p>
        {import.meta.env.DEV && <DevLoginPanel />}
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.9h5.5c-.24 1.4-1.7 4.1-5.5 4.1-3.3 0-6-2.7-6-6.1s2.7-6.1 6-6.1c1.9 0 3.1.8 3.8 1.5l2.6-2.5C16.7 3.4 14.6 2.4 12 2.4 6.7 2.4 2.5 6.6 2.5 12s4.2 9.6 9.5 9.6c5.5 0 9.1-3.8 9.1-9.3 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  );
}
