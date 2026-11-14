import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { requestPasswordReset } from "@/lib/passwordReset";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Eye,
  EyeOff,
  Lock,
  Mail,
  Shield,
  Store,
  Bike,
  Headphones,
  Loader2,
  ArrowLeft,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { describeAuthError } from "@/lib/authErrors";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/staff-login")({
  head: () => ({ meta: [{ title: "Management Portal — AP Mart" }] }),
  component: StaffLoginPage,
});

type RoleKey = "admin" | "shopkeeper" | "delivery" | "support";

const ROLES: Array<{
  key: RoleKey;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  iconBg: string;
  iconColor: string;
  dashboard: string;
}> = [
  {
    key: "admin",
    title: "Admin",
    subtitle: "Platform Administrator",
    icon: Shield,
    iconBg: "bg-tint-mint",
    iconColor: "text-primary-ink",
    dashboard: "/admin/dashboard",
  },
  {
    key: "shopkeeper",
    title: "Shopkeeper",
    subtitle: "Manage your Shop",
    icon: Store,
    iconBg: "bg-tint-sky",
    iconColor: "text-primary-ink",
    dashboard: "/shopkeeper/dashboard",
  },
  {
    key: "delivery",
    title: "Delivery",
    subtitle: "Deliver Orders",
    icon: Bike,
    iconBg: "bg-tint-peach",
    iconColor: "text-primary-ink",
    dashboard: "/delivery/dashboard",
  },
  {
    key: "support",
    title: "Support",
    subtitle: "Handle Tickets",
    icon: Headphones,
    iconBg: "bg-tint-violet",
    iconColor: "text-primary-ink",
    dashboard: "/support/dashboard",
  },
];

function StaffLoginPage() {
  const [role, setRole] = useState<RoleKey | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    try {
      const stored = localStorage.getItem("flashbasket.staff");
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed?.email) setEmail(parsed.email);
        if (parsed?.role) setRole(parsed.role);
      }
    } catch {
      // Best effort: storage may be unavailable or the step is optional.
    }
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    const { error } = await signIn(email, password, remember);
    if (error) {
      setSubmitting(false);
      toast.error(describeAuthError(error));
      return;
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();
    let actualRoles: string[] = [];
    if (user) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      actualRoles = (data ?? []).map((r) => r.role);
    }

    // Hidden platform-owner path: the tier is never advertised in the UI, it is
    // only resolved server-side from the authenticated account's roles.
    if (actualRoles.includes("super_admin")) {
      try {
        if (remember) localStorage.setItem("flashbasket.staff", JSON.stringify({ email }));
        else localStorage.removeItem("flashbasket.staff");
      } catch {
        // Best effort: storage may be unavailable or the step is optional.
      }
      toast.success("Welcome back");
      navigate({ to: "/super-admin/dashboard", replace: true });
      return;
    }

    if (!role) {
      setSubmitting(false);
      await supabase.auth.signOut();
      toast.error("Please select a role to continue");
      return;
    }

    if (!actualRoles.includes(role)) {
      setSubmitting(false);
      await supabase.auth.signOut();
      toast.error(`This account does not have ${role} access`);
      return;
    }

    try {
      if (remember) localStorage.setItem("flashbasket.staff", JSON.stringify({ email, role }));
      else localStorage.removeItem("flashbasket.staff");
    } catch {
      // Best effort: storage may be unavailable or the step is optional.
    }

    const target = ROLES.find((r) => r.key === role)!.dashboard;
    toast.success("Welcome back");
    navigate({ to: target });
  }

  async function handleForgot() {
    const target = email || window.prompt("Enter your email to receive a reset link") || "";
    if (!target) return;
    const { error } = await requestPasswordReset(target);
    if (error) toast.error(error);
    else toast.success("If an account exists for that email, a reset link has been sent.");
  }

  return (
    <div className="flex min-h-screen items-start justify-center bg-background px-4 pb-10 pt-safe md:items-center">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between pt-4">
          <Link
            to="/login"
            className="press inline-flex h-9 items-center gap-1 rounded-full bg-secondary px-3.5 text-meta font-medium text-muted-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Back to app
          </Link>
        </div>

        <div className="mt-6 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-tint-mint text-primary-ink">
            <Shield className="h-7 w-7" />
          </div>
          <h1 className="large-title mt-3">Staff sign in</h1>
          <p className="mt-1 text-meta text-muted-foreground">Access your AP Mart dashboard</p>
        </div>

        <div className="mt-6 rounded-xl border border-border/70 bg-card p-4 md:p-6">
          <div className="eyebrow mb-3">Sign in as</div>
          <div className="grid grid-cols-2 gap-2.5">
            {ROLES.map((r) => {
              const Icon = r.icon;
              const active = role === r.key;
              return (
                <button
                  type="button"
                  key={r.key}
                  onClick={() => setRole(r.key)}
                  className={cn(
                    "press flex items-center gap-3 rounded-xl p-3 text-left transition-all",
                    active ? "bg-primary-soft ring-2 ring-primary" : "bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "grid h-10 w-10 shrink-0 place-items-center rounded-xl",
                      r.iconBg,
                    )}
                  >
                    <Icon className={cn("h-5 w-5", r.iconColor)} />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-meta font-semibold leading-tight">{r.title}</span>
                    <span className="block truncate text-caption leading-tight text-muted-foreground">
                      {r.subtitle}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="mt-5 space-y-3">
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
        </div>

        <p className="mt-5 text-center text-meta text-muted-foreground">
          Customer?{" "}
          <Link to="/login" className="font-semibold text-primary">
            Use the main app
          </Link>
        </p>
      </div>
    </div>
  );
}
