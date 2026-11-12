import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, Users, Store, ShieldAlert, ScrollText, Loader2, Lock, BarChart3, Sliders, KeyRound, Database, Wallet } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super-admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Super Admin Overview — AP Mart" },
      { name: "description", content: "Platform-wide control centre: role tiers, shops, and the security audit trail." },
      { property: "og:title", content: "Super Admin Overview — AP Mart" },
      { property: "og:description", content: "Platform-wide control centre for AP Mart system owners." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperAdminDashboard,
});

type UserRow = { id: string; full_name: string | null; email: string | null; status: string | null; roles: string[] };

function SuperAdminDashboard() {
  const { data: users, isLoading } = useQuery({
    queryKey: ["super-admin", "users-summary"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_list_users");
      if (error) throw error;
      return (data ?? []) as unknown as UserRow[];
    },
  });

  const { data: shopCount } = useQuery({
    queryKey: ["super-admin", "shop-count"],
    queryFn: async () => {
      const { count, error } = await supabase.from("shops").select("id", { count: "exact", head: true });
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: recentEvents } = useQuery({
    queryKey: ["super-admin", "recent-security-events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("security_audit_log")
        .select("id, event_type, created_at, detail")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  const count = (role: string) => (users ?? []).filter((u) => (u.roles ?? []).includes(role)).length;

  const stats = [
    { label: "Super Admins", value: count("super_admin"), icon: Crown, tone: "text-amber-600 bg-amber-50" },
    { label: "Admins", value: count("admin"), icon: ShieldAlert, tone: "text-emerald-600 bg-emerald-50" },
    { label: "Staff accounts", value: count("shopkeeper") + count("delivery") + count("support"), icon: Users, tone: "text-violet-600 bg-violet-50" },
    { label: "Shops", value: shopCount ?? 0, icon: Store, tone: "text-blue-600 bg-blue-50" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Platform control centre</h1>
        <p className="text-sm text-muted-foreground">
          Exclusive Super Admin powers. Regular Admins keep daily operations only.
        </p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-10"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {stats.map((s) => (
            <div key={s.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className={`inline-grid h-9 w-9 place-items-center rounded-xl ${s.tone}`}>
                <s.icon className="h-4 w-4" />
              </div>
              <div className="mt-3 text-2xl font-extrabold">{s.value}</div>
              <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[
          { to: "/super-admin/access", icon: Users, title: "Roles & Access", desc: "Create, promote, demote or suspend any account including Admins." },
          { to: "/super-admin/analytics", icon: BarChart3, title: "Revenue analytics", desc: "Platform-wide revenue, order volume and growth." },
          { to: "/super-admin/settings", icon: Sliders, title: "Platform settings", desc: "Feature flags, maintenance mode, payment, delivery, AI and notification switches." },
          { to: "/super-admin/integrations", icon: KeyRound, title: "API keys & integrations", desc: "Razorpay, Maps, WhatsApp, SMS, email and push configuration status." },
          { to: "/super-admin/health", icon: Database, title: "Database health", desc: "Table volumes, write activity and backup posture." },
          { to: "/super-admin/audit", icon: ScrollText, title: "Security audit log", desc: "Every role change, activation and suspension — Super Admin only." },
          { to: "/admin/shops", icon: Store, title: "Shop approvals", desc: "Approve, enable or disable shops and assign owners." },
          { to: "/admin/customers", icon: Users, title: "User management", desc: "Full customer and staff directory across the platform." },
          { to: "/admin/payments", icon: Wallet, title: "Payments & refunds", desc: "Every transaction, refund and reconciliation record." },
        ].map((t) => (
          <Link
            key={t.to}
            to={t.to as any}
            className="rounded-2xl border border-border bg-card p-5 shadow-sm hover:border-primary/40 transition"
          >
            <t.icon className="h-5 w-5 text-emerald-600" />
            <h2 className="mt-2 font-display font-extrabold text-sm">{t.title}</h2>
            <p className="text-xs text-muted-foreground mt-1">{t.desc}</p>
          </Link>
        ))}
      </div>


      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-display font-extrabold text-sm">Latest security events</h2>
        {(recentEvents ?? []).length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No security events recorded yet.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {(recentEvents ?? []).map((e: any) => (
              <li key={e.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="font-semibold">{e.event_type.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">{new Date(e.created_at).toLocaleString()}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-2xl border border-dashed border-border bg-muted/30 p-5">
        <div className="flex items-center gap-2 text-sm font-bold">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Credentials &amp; integrations
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Payment gateway keys, Maps, SMS, push and AI provider credentials are stored as encrypted backend secrets and are
          never readable from the app — not even by a Super Admin. That is deliberate: a UI that could display a live secret
          key would be the single biggest breach risk on the platform. They are managed from your project's secret settings.
        </p>
      </div>
    </div>
  );
}
