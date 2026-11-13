import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Crown,
  Users,
  Store,
  ShieldAlert,
  ScrollText,
  Loader2,
  Lock,
  BarChart3,
  Sliders,
  KeyRound,
  Database,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super-admin/dashboard")({
  head: () => ({
    meta: [
      { title: "Super Admin Overview — AP Mart" },
      {
        name: "description",
        content: "Platform-wide control centre: role tiers, shops, and the security audit trail.",
      },
      { property: "og:title", content: "Super Admin Overview — AP Mart" },
      {
        property: "og:description",
        content: "Platform-wide control centre for AP Mart system owners.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SuperAdminDashboard,
});

type UserRow = {
  id: string;
  full_name: string | null;
  email: string | null;
  status: string | null;
  roles: string[];
};

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
      const { count, error } = await supabase
        .from("shops")
        .select("id", { count: "exact", head: true });
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

  const count = (role: string) =>
    (users ?? []).filter((u) => (u.roles ?? []).includes(role)).length;

  const stats = [
    {
      label: "Super Admins",
      value: count("super_admin"),
      icon: Crown,
      tone: "bg-tint-violet text-[oklch(0.42_0.1_290)]",
    },
    {
      label: "Admins",
      value: count("admin"),
      icon: ShieldAlert,
      tone: "bg-tint-sky text-[oklch(0.42_0.1_235)]",
    },
    {
      label: "Staff accounts",
      value: count("shopkeeper") + count("delivery") + count("support"),
      icon: Users,
      tone: "bg-tint-peach text-[oklch(0.45_0.1_50)]",
    },
    { label: "Shops", value: shopCount ?? 0, icon: Store, tone: "bg-tint-mint text-primary-ink" },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h1 className="large-title">Platform control centre</h1>
        <p className="mt-0.5 text-small text-muted-foreground">
          Exclusive Super Admin powers. Regular Admins keep daily operations only.
        </p>
      </div>

      {isLoading ? (
        <div className="grid place-items-center py-10">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2.5 md:gap-4 lg:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="rounded-xl border border-border/70 bg-card p-3.5">
              <div className={`mb-2.5 grid h-9 w-9 place-items-center rounded-lg ${s.tone}`}>
                <s.icon className="h-[17px] w-[17px]" />
              </div>
              <div className="text-small text-muted-foreground">{s.label}</div>
              <div className="mt-0.5 text-xl font-semibold tracking-tight">{s.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid gap-2.5 sm:grid-cols-2 md:gap-3 lg:grid-cols-3">
        {[
          {
            to: "/super-admin/access",
            icon: Users,
            title: "Roles & Access",
            desc: "Create, promote, demote or suspend any account including Admins.",
          },
          {
            to: "/super-admin/analytics",
            icon: BarChart3,
            title: "Revenue analytics",
            desc: "Platform-wide revenue, order volume and growth.",
          },
          {
            to: "/super-admin/settings",
            icon: Sliders,
            title: "Platform settings",
            desc: "Feature flags, maintenance mode, payment, delivery, AI and notification switches.",
          },
          {
            to: "/super-admin/integrations",
            icon: KeyRound,
            title: "API keys & integrations",
            desc: "Razorpay, Maps, WhatsApp, SMS, email and push configuration status.",
          },
          {
            to: "/super-admin/health",
            icon: Database,
            title: "Database health",
            desc: "Table volumes, write activity and backup posture.",
          },
          {
            to: "/super-admin/audit",
            icon: ScrollText,
            title: "Security audit log",
            desc: "Every role change, activation and suspension — Super Admin only.",
          },
          {
            to: "/admin/shops",
            icon: Store,
            title: "Shop approvals",
            desc: "Approve, enable or disable shops and assign owners.",
          },
          {
            to: "/admin/customers",
            icon: Users,
            title: "User management",
            desc: "Full customer and staff directory across the platform.",
          },
          {
            to: "/admin/payments",
            icon: Wallet,
            title: "Payments & refunds",
            desc: "Every transaction, refund and reconciliation record.",
          },
        ].map((t) => (
          <Link
            key={t.to}
            to={t.to as any}
            className="press rounded-xl border border-border/70 bg-card p-4 transition-colors hover:bg-secondary/40"
          >
            <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary-soft text-primary-ink">
              <t.icon className="h-[17px] w-[17px]" />
            </span>
            <h2 className="mt-2.5 text-body font-semibold">{t.title}</h2>
            <p className="mt-0.5 text-small leading-snug text-muted-foreground">{t.desc}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border border-border/70 bg-card p-4">
        <h2 className="section-title">Latest security events</h2>
        {(recentEvents ?? []).length === 0 ? (
          <p className="mt-2 text-small text-muted-foreground">No security events recorded yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-border/60">
            {(recentEvents ?? []).map((e: any) => (
              <li key={e.id} className="flex items-center justify-between gap-3 py-2.5 text-small">
                <span className="font-medium">{e.event_type.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">
                  {new Date(e.created_at).toLocaleString()}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-border bg-secondary/50 p-4">
        <div className="flex items-center gap-2 text-body font-semibold">
          <Lock className="h-4 w-4 text-muted-foreground" />
          Credentials &amp; integrations
        </div>
        <p className="mt-1 text-small leading-relaxed text-muted-foreground">
          Payment gateway keys, Maps, SMS, push and AI provider credentials are stored as encrypted
          backend secrets and are never readable from the app — not even by a Super Admin. That is
          deliberate: a UI that could display a live secret key would be the single biggest breach
          risk on the platform. They are managed from your project's secret settings.
        </p>
      </div>
    </div>
  );
}
