import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Eye, EyeOff, Lock, Mail, Shield, Store, Bike, Headphones, Loader2, ArrowLeft } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { describeAuthError } from "@/lib/authErrors";
import { cn } from "@/lib/utils";
import { publicSiteOrigin } from "@/lib/api-base";

export const Route = createFileRoute("/staff-login")({
  head: () => ({ meta: [{ title: "Management Portal — AP Mart" }] }),
  component: StaffLoginPage,
});

type RoleKey = "admin" | "shopkeeper" | "delivery" | "support";

const ROLES: Array<{
  key: RoleKey;
  title: string;
  subtitle: string;
  icon: any;
  iconBg: string;
  iconColor: string;
  dashboard: string;
}> = [
  { key: "admin", title: "Admin", subtitle: "Platform Administrator", icon: Shield, iconBg: "bg-emerald-100", iconColor: "text-emerald-600", dashboard: "/admin/dashboard" },
  { key: "shopkeeper", title: "Shopkeeper", subtitle: "Manage your Shop", icon: Store, iconBg: "bg-blue-100", iconColor: "text-blue-600", dashboard: "/shopkeeper/dashboard" },
  { key: "delivery", title: "Delivery", subtitle: "Deliver Orders", icon: Bike, iconBg: "bg-orange-100", iconColor: "text-orange-600", dashboard: "/delivery/dashboard" },
  { key: "support", title: "Support", subtitle: "Handle Tickets", icon: Headphones, iconBg: "bg-violet-100", iconColor: "text-violet-600", dashboard: "/support/dashboard" },
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
    } catch {}
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

    const { data: { user } } = await supabase.auth.getUser();
    let actualRoles: string[] = [];
    if (user) {
      const { data } = await supabase.from("user_roles").select("role").eq("user_id", user.id);
      actualRoles = (data ?? []).map((r: any) => r.role);
    }

    // Hidden platform-owner path: the tier is never advertised in the UI, it is
    // only resolved server-side from the authenticated account's roles.
    if (actualRoles.includes("super_admin")) {
      try {
        if (remember) localStorage.setItem("flashbasket.staff", JSON.stringify({ email }));
        else localStorage.removeItem("flashbasket.staff");
      } catch {}
      toast.success("Welcome back");
      navigate({ to: "/super-admin/dashboard" as any, replace: true });
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
    } catch {}

    const target = ROLES.find((r) => r.key === role)!.dashboard;
    toast.success("Welcome back");
    navigate({ to: target as any });
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
        <div className="flex items-center justify-between px-4 pt-3">
          <Link to="/login" className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-3.5 w-3.5" /> Back to app
          </Link>
          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Management Portal</span>
        </div>

        {/* Hero illustration */}
        <div className="relative h-44 md:h-52 overflow-hidden mt-2" style={{ background: "linear-gradient(135deg, #bbf7d0 0%, #86efac 60%, #4ade80 100%)" }}>
          <svg viewBox="0 0 400 200" className="absolute inset-0 w-full h-full" preserveAspectRatio="xMidYMid slice">
            <g fill="rgba(255,255,255,0.12)">
              <ellipse cx="60" cy="40" rx="22" ry="6" />
              <ellipse cx="320" cy="32" rx="28" ry="7" />
              <ellipse cx="350" cy="60" rx="18" ry="5" />
            </g>
            <g transform="translate(40,90)">
              <rect x="0" y="40" width="80" height="60" fill="#f5f5f0" rx="3" />
              <rect x="0" y="30" width="80" height="14" fill="#16a34a" />
              <g fill="#f5f5f0">
                <rect x="0" y="30" width="10" height="14" />
                <rect x="20" y="30" width="10" height="14" />
                <rect x="40" y="30" width="10" height="14" />
                <rect x="60" y="30" width="10" height="14" />
              </g>
              <rect x="10" y="55" width="40" height="6" fill="#cbd5d1" />
              <rect x="10" y="68" width="50" height="4" fill="#cbd5d1" />
              <rect x="10" y="78" width="35" height="4" fill="#cbd5d1" />
              <rect x="55" y="55" width="20" height="45" fill="#1f2937" />
            </g>
            <g transform="translate(160,30)">
              <rect x="0" y="0" width="78" height="140" rx="14" fill="#ffffff" stroke="#0e3b2a" strokeWidth="2" />
              <rect x="6" y="14" width="66" height="118" rx="6" fill="#f8fafc" />
              <path d="M20 110 Q 38 60 60 30" stroke="#16a34a" strokeWidth="2.5" strokeDasharray="4 4" fill="none" />
              <circle cx="60" cy="30" r="6" fill="#16a34a" />
              <circle cx="60" cy="30" r="2" fill="#fff" />
            </g>
            <g transform="translate(255,110)">
              <rect x="0" y="20" width="34" height="30" fill="#d8a564" rx="2" />
              <rect x="0" y="30" width="34" height="3" fill="#a07842" />
              <rect x="15" y="20" width="4" height="30" fill="#a07842" />
            </g>
            <g transform="translate(290,80)">
              <circle cx="20" cy="62" r="10" fill="#1f2937" />
              <circle cx="20" cy="62" r="4" fill="#9ca3af" />
              <circle cx="62" cy="62" r="10" fill="#1f2937" />
              <circle cx="62" cy="62" r="4" fill="#9ca3af" />
              <path d="M10 55 Q 25 30 55 35 L 70 55 Z" fill="#16a34a" />
              <rect x="30" y="20" width="22" height="20" rx="3" fill="#16a34a" />
              <circle cx="41" cy="20" r="8" fill="#0e3b2a" />
              <circle cx="41" cy="20" r="5" fill="#16a34a" />
            </g>
          </svg>
        </div>

        <div className="p-6 md:p-8 -mt-3 bg-card rounded-t-3xl relative">
          <div className="text-center">
            <h1 className="font-display text-2xl font-extrabold text-foreground">Welcome Back!</h1>
            <p className="mt-1 text-sm text-muted-foreground">Login to access your dashboard</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-6 space-y-3">
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="email"
                required
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-12 rounded-xl pl-10"
              />
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
              <button
                type="button"
                aria-label={show ? "Hide password" : "Show password"}
                onClick={() => setShow((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>

            <div className="flex items-center justify-between pt-1">
              <label className="flex items-center gap-2 text-xs font-medium text-muted-foreground cursor-pointer">
                <Checkbox checked={remember} onCheckedChange={(v) => setRemember(!!v)} />
                Remember me
              </label>
              <button
                type="button"
                onClick={handleForgot}
                className="text-xs font-bold text-primary hover:underline"
              >
                Forgot Password?
              </button>
            </div>

            <Button
              type="submit"
              disabled={submitting}
              className="w-full h-12 rounded-xl bg-[#16a34a] hover:bg-[#15803d] text-white font-bold text-base shadow-md"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Signing in…</>
              ) : (
                "Login"
              )}
            </Button>
          </form>

          <div className="relative my-5">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
            <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted-foreground">or login as</span></div>
          </div>

          {/* Role selector */}
          <div className="grid grid-cols-4 gap-2">
            {ROLES.map((r) => {
              const Icon = r.icon;
              const active = role === r.key;
              return (
                <motion.button
                  type="button"
                  key={r.key}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setRole(r.key)}
                  className={cn(
                    "flex flex-col items-center gap-1.5 rounded-2xl border-2 p-2.5 text-center transition-all",
                    active
                      ? "border-primary bg-primary/5 shadow-lg shadow-primary/20"
                      : "border-border bg-card hover:border-primary/40 hover:shadow-sm",
                  )}
                >
                  <span className={cn("grid h-10 w-10 place-items-center rounded-xl", r.iconBg)}>
                    <Icon className={cn("h-5 w-5", r.iconColor)} />
                  </span>
                  <span className={cn("text-[11px] font-extrabold leading-tight", active ? "text-primary" : "text-foreground")}>
                    {r.title}
                  </span>
                  <span className="text-[9px] leading-tight text-muted-foreground line-clamp-2">
                    {r.subtitle}
                  </span>
                </motion.button>
              );
            })}
          </div>

          <p className="mt-5 text-center text-xs text-muted-foreground">
            Customer?{" "}
            <Link to="/login" className="font-bold text-primary hover:underline">
              Use the main app
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
