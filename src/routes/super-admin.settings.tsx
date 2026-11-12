import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Save, Wrench, Flag, Truck, Bell, Sparkles, CreditCard } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { DeleteAccountSection } from "@/components/DeleteAccountSection";

export const Route = createFileRoute("/super-admin/settings")({
  head: () => ({
    meta: [
      { title: "Platform Settings — AP Mart" },
      { name: "description", content: "Global platform, payment, delivery, AI, notification settings, feature flags and maintenance mode." },
      { property: "og:title", content: "Platform Settings — AP Mart" },
      { property: "og:description", content: "Global platform configuration and feature flags." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PlatformSettings,
});

/** Only non-sensitive config keys are ever surfaced here. Credential-bearing
 *  keys live in encrypted backend secrets and are never readable from the app. */
type Group = { title: string; icon: any; items: Array<{ key: string; label: string; hint?: string; kind: "bool" | "text" }> };

const GROUPS: Group[] = [
  {
    title: "Maintenance",
    icon: Wrench,
    items: [
      { key: "maintenance_mode", label: "Maintenance mode", hint: "Blocks customer ordering and shows a maintenance notice.", kind: "bool" },
      { key: "maintenance_message", label: "Maintenance message", kind: "text" },
    ],
  },
  {
    title: "Feature flags",
    icon: Flag,
    items: [
      { key: "enable_customer_shop_selection", label: "Customer can pick a shop", kind: "bool" },
      { key: "feature_multi_shop_orders", label: "Multi-shop consolidated orders", kind: "bool" },
      { key: "feature_fast_delivery", label: "Fast / express delivery tiers", kind: "bool" },
      { key: "feature_reviews", label: "Product reviews", kind: "bool" },
      { key: "feature_coupons", label: "Coupons & promotions", kind: "bool" },
      { key: "feature_support_chat", label: "In-app support chat", kind: "bool" },
    ],
  },
  {
    title: "Payments",
    icon: CreditCard,
    items: [
      { key: "payments_cod_enabled", label: "Cash on delivery", kind: "bool" },
      { key: "payments_online_enabled", label: "Online payments (Razorpay)", kind: "bool" },
      { key: "payments_cod_max_order", label: "Max COD order value (₹)", kind: "text" },
    ],
  },
  {
    title: "Delivery",
    icon: Truck,
    items: [
      { key: "delivery_max_radius_km", label: "Max delivery radius (km)", kind: "text" },
      { key: "delivery_auto_assign", label: "Auto-assign riders", kind: "bool" },
      { key: "delivery_assignment_window_min", label: "Shop acceptance window (min)", kind: "text" },
    ],
  },
  {
    title: "Notifications",
    icon: Bell,
    items: [
      { key: "notify_push_enabled", label: "Push notifications", kind: "bool" },
      { key: "notify_email_enabled", label: "Email notifications", kind: "bool" },
      { key: "notify_sms_enabled", label: "SMS notifications", kind: "bool" },
      { key: "notify_whatsapp_enabled", label: "WhatsApp notifications", kind: "bool" },
    ],
  },
  {
    title: "AI",
    icon: Sparkles,
    items: [
      { key: "ai_search_enabled", label: "AI-assisted product search", kind: "bool" },
      { key: "ai_support_replies_enabled", label: "AI draft replies for support", kind: "bool" },
    ],
  },
];

function PlatformSettings() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["super-admin", "app-config"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_config").select("key, value");
      if (error) throw error;
      const map: Record<string, string> = {};
      for (const row of data ?? []) map[(row as any).key] = (row as any).value;
      return map;
    },
  });

  useEffect(() => {
    if (data) setDraft(data);
  }, [data]);

  const get = (k: string) => draft[k] ?? "";
  const set = (k: string, v: string) => setDraft((d) => ({ ...d, [k]: v }));

  async function save() {
    setSaving(true);
    const keys = GROUPS.flatMap((g) => g.items.map((i) => i.key));
    const rows = keys
      .filter((k) => draft[k] !== undefined && draft[k] !== (data?.[k] ?? undefined))
      .map((k) => ({ key: k, value: draft[k] ?? "" }));
    if (rows.length === 0) {
      setSaving(false);
      toast.info("Nothing to save");
      return;
    }
    const { error } = await supabase.from("app_config").upsert(rows, { onConflict: "key" });
    setSaving(false);
    if (error) toast.error(error.message);
    else {
      toast.success("Platform settings saved");
      qc.invalidateQueries({ queryKey: ["super-admin", "app-config"] });
    }
  }

  if (isLoading) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-extrabold">Platform settings</h1>
          <p className="text-sm text-muted-foreground">Global switches that apply to every shop, rider and customer.</p>
        </div>
        <Button onClick={save} disabled={saving} className="rounded-xl font-bold">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          <span className="ml-1.5">Save</span>
        </Button>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        {GROUPS.map((g) => (
          <section key={g.title} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-display text-sm font-extrabold">
              <g.icon className="h-4 w-4 text-emerald-600" />
              {g.title}
            </h2>
            <div className="mt-3 space-y-3">
              {g.items.map((i) =>
                i.kind === "bool" ? (
                  <div key={i.key} className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{i.label}</div>
                      {i.hint && <div className="text-[11px] text-muted-foreground">{i.hint}</div>}
                    </div>
                    <Switch
                      checked={get(i.key) === "true"}
                      onCheckedChange={(v) => set(i.key, v ? "true" : "false")}
                    />
                  </div>
                ) : (
                  <div key={i.key}>
                    <label className="text-xs font-semibold text-muted-foreground">{i.label}</label>
                    <Input
                      value={get(i.key)}
                      onChange={(e) => set(i.key, e.target.value)}
                      className="mt-1 h-10 rounded-xl"
                    />
                  </div>
                ),
              )}
            </div>
          </section>
        ))}

        <DeleteAccountSection />
      </div>
    </div>
  );
}
