import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Loader2, TrendingUp, IndianRupee, ShoppingBag, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/super-admin/analytics")({
  head: () => ({
    meta: [
      { title: "Revenue & Global Analytics — AP Mart" },
      { name: "description", content: "Platform-wide revenue, order volume and growth analytics for AP Mart system owners." },
      { property: "og:title", content: "Revenue & Global Analytics — AP Mart" },
      { property: "og:description", content: "Platform-wide revenue and order analytics." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AnalyticsPage,
});

const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");

function AnalyticsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["super-admin", "revenue-analytics"],
    queryFn: async () => {
      const since = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data: orders, error } = await supabase
        .from("orders")
        .select("id, total, status, payment_status, placed_at, shop_id, user_id")
        .gte("placed_at", since)
        .order("placed_at", { ascending: false })
        .limit(2000);
      if (error) throw error;
      return orders ?? [];
    },
  });

  const orders = data ?? [];
  const paid = orders.filter((o: any) => o.payment_status === "paid" || o.payment_status === "cod");
  const revenue = paid.reduce((s: number, o: any) => s + Number(o.total ?? 0), 0);
  const delivered = orders.filter((o: any) => o.status === "delivered").length;
  const cancelled = orders.filter((o: any) => o.status === "cancelled").length;
  const customers = new Set(orders.map((o: any) => o.user_id)).size;
  const aov = paid.length ? revenue / paid.length : 0;

  const byDay = new Map<string, number>();
  for (const o of paid) {
    const d = new Date((o as any).placed_at).toISOString().slice(0, 10);
    byDay.set(d, (byDay.get(d) ?? 0) + Number((o as any).total ?? 0));
  }
  const days = Array.from(byDay.entries()).sort(([a], [b]) => (a < b ? -1 : 1)).slice(-14);
  const peak = Math.max(1, ...days.map(([, v]) => v));

  const stats = [
    { label: "Revenue (30d)", value: inr(revenue), icon: IndianRupee },
    { label: "Orders (30d)", value: orders.length, icon: ShoppingBag },
    { label: "Avg order value", value: inr(aov), icon: TrendingUp },
    { label: "Active customers", value: customers, icon: Users },
  ];

  if (isLoading) {
    return <div className="grid place-items-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-extrabold">Revenue &amp; global analytics</h1>
        <p className="text-sm text-muted-foreground">Everything that happened across every shop in the last 30 days.</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <s.icon className="h-4 w-4 text-emerald-600" />
            <div className="mt-3 text-xl font-extrabold">{s.value}</div>
            <div className="text-xs font-medium text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
        <h2 className="font-display text-sm font-extrabold">Daily revenue (last 14 days)</h2>
        {days.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">No paid orders yet.</p>
        ) : (
          <div className="mt-4 flex items-end gap-1.5 h-40">
            {days.map(([d, v]) => (
              <div key={d} className="flex-1 flex flex-col items-center gap-1">
                <div
                  className="w-full rounded-t-md bg-primary/70"
                  style={{ height: `${Math.max(4, (v / peak) * 130)}px` }}
                  title={`${d}: ${inr(v)}`}
                />
                <span className="text-[9px] text-muted-foreground">{d.slice(5)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="text-xs font-medium text-muted-foreground">Delivered (30d)</div>
          <div className="text-2xl font-extrabold">{delivered}</div>
        </div>
        <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
          <div className="text-xs font-medium text-muted-foreground">Cancelled (30d)</div>
          <div className="text-2xl font-extrabold">{cancelled}</div>
        </div>
      </div>
    </div>
  );
}
