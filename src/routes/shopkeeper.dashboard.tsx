import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RoleShell } from "@/components/RoleShell";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/format";
import { toast } from "sonner";
import { LayoutDashboard, ListOrdered, Package, Wallet, Bell, Star, Settings, Check, X, PackageCheck, Truck, AlertTriangle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { DeliveryTypeBadge } from "@/components/FastDeliveryBadge";
import { runOptimistic, patchRow, removeRow } from "@/lib/optimistic";





const NAV = [
  { to: "/shopkeeper/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/shopkeeper/orders", label: "Orders", icon: ListOrdered },
  { to: "/shopkeeper/products", label: "Products", icon: Package },
  { to: "/shopkeeper/delivery", label: "Delivery", icon: Truck },
  { to: "/shopkeeper/earnings", label: "Earnings", icon: Wallet },
  { to: "/shopkeeper/notifications", label: "Alerts", icon: Bell },
  { to: "/shopkeeper/reviews", label: "Reviews", icon: Star },
  { to: "/shopkeeper/settings", label: "Settings", icon: Settings },
];

export const Route = createFileRoute("/shopkeeper/dashboard")({
  head: () => ({ meta: [{ title: "Shopkeeper Dashboard — AP Mart" }] }),
  component: Page,
});

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [shopId, setShopId] = useState<string | null>(null);
  const [shopLoading, setShopLoading] = useState(true);

  // Load my shop (+ realtime when admin assigns one)
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    const load = async () => {
      const { data } = await supabase.from("shops").select("id").eq("owner_id", user.id).order("name").limit(1);
      if (cancelled) return;
      setShopId(data?.[0]?.id ?? null);
      setShopLoading(false);
    };
    setShopLoading(true);
    load();
    const ch = supabase
      .channel("my-shop-" + user.id)
      .on("postgres_changes", { event: "*", schema: "public", table: "shops", filter: `owner_id=eq.${user.id}` }, () => load())
      .subscribe();
    return () => { cancelled = true; supabase.removeChannel(ch); };
  }, [user]);

  // Realtime: refetch on any orders change for my shop
  useEffect(() => {
    if (!shopId) return;
    const ch = supabase
      .channel("shop-orders-" + shopId)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `shop_id=eq.${shopId}` }, () => {
        qc.invalidateQueries({ queryKey: ["shop-orders", shopId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [shopId, qc]);

  const orders = useQuery({
    queryKey: ["shop-orders", shopId],
    queryFn: async () => {
      if (!shopId) return [];
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, total, placed_at, assignment_expires_at, address, payment_method, delivery_type, delivery_pincode, assignment_distance_km, parent_order_id")
        .eq("shop_id", shopId)
        .order("placed_at", { ascending: false })
        .limit(30);
      return data ?? [];
    },
    enabled: !!shopId,
  });


  const itemStats = useQuery({
    queryKey: ["shop-order-item-stats", (orders.data ?? []).map(o => o.id).join(",")],
    enabled: (orders.data?.length ?? 0) > 0,
    queryFn: async () => {
      const ids = (orders.data ?? []).map(o => o.id);
      const { data } = await supabase.from("order_items").select("order_id, child_order_id, quantity").or(`order_id.in.(${ids.join(",")}),child_order_id.in.(${ids.join(",")})`);
      const map: Record<string, { products: number; qty: number }> = {};
      for (const r of (data ?? []) as any[]) {
        const key = ids.includes(r.child_order_id) ? r.child_order_id : r.order_id;
        if (!map[key]) map[key] = { products: 0, qty: 0 };
        map[key].products += 1;
        map[key].qty += Number(r.quantity) || 0;
      }
      return map;
    },
  });

  const expiry = useQuery({
    queryKey: ["shop-expiry-summary", shopId],
    queryFn: async () => {
      if (!shopId) return { expired: 0, week: 0, month: 0, valueAtRisk: 0 };
      const { data } = await (supabase as any)
        .from("shop_products")
        .select("stock, price, expiry_date, is_available")
        .eq("shop_id", shopId)
        .not("expiry_date", "is", null);
      const rows = (data ?? []) as { stock: number; price: number; expiry_date: string; is_available: boolean }[];
      const today = new Date(); today.setHours(0, 0, 0, 0);
      let expired = 0, week = 0, month = 0, valueAtRisk = 0;
      for (const r of rows) {
        const d = new Date(r.expiry_date); d.setHours(0, 0, 0, 0);
        const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
        if (diff < 0) { expired++; valueAtRisk += Number(r.price) * Number(r.stock); }
        else if (diff <= 7) { week++; valueAtRisk += Number(r.price) * Number(r.stock); }
        else if (diff <= 30) { month++; }
      }
      return { expired, week, month, valueAtRisk };
    },
    enabled: !!shopId,
  });


  // Multi-shop child orders must use the child-aware RPCs so the parent order
  // (the one the customer tracks) gets its status rolled up correctly.
  const isChildOrder = (id: string) =>
    !!(orders.data ?? []).find((o: any) => o.id === id)?.parent_order_id;

  const accept = async (id: string) => {
    const child = isChildOrder(id);
    await runOptimistic({
      qc,
      keys: [["shop-orders", shopId]],
      updater: patchRow(id, { status: "accepted_by_shop" }),
      request: () =>
        (supabase.rpc as any)(child ? "shop_accept_child" : "shop_accept_order",
          child ? { _child_id: id, _prep_minutes: 15 } : { _order_id: id }),
      success: "Order accepted",
    });
  };
  const reject = async (id: string) => {
    const reason = window.prompt("Reason for rejecting this order? (optional)") ?? null;
    const child = isChildOrder(id);
    await runOptimistic({
      qc,
      keys: [["shop-orders", shopId]],
      // rejected orders leave this shop's queue immediately
      updater: removeRow(id),
      request: () =>
        (supabase.rpc as any)(child ? "shop_reject_child" : "shop_reject_order",
          child ? { _child_id: id, _reason: reason } : { _order_id: id, _reason: reason }),
      success: "Order rejected — re-routing to next shop",
    });
  };
  const pack = async (id: string) => {
    const child = isChildOrder(id);
    await runOptimistic({
      qc,
      keys: [["shop-orders", shopId]],
      updater: patchRow(id, { status: "packed" }),
      request: () =>
        (supabase.rpc as any)(child ? "shop_mark_child_ready" : "shop_mark_packed",
          child ? { _child_id: id } : { _order_id: id }),
      success: "Marked packed",
    });
  };


  return (
    <RoleShell role="shopkeeper" nav={NAV} requireRoles={["shopkeeper", "admin"]}>
      <div className="p-4 md:p-6">
        <h1 className="font-display text-3xl font-extrabold">Shop dashboard</h1>
        {shopLoading ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">Loading your shop…</p>
          </div>
        ) : !shopId ? (
          <div className="mt-6 rounded-2xl border border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">You don't own a shop yet. Ask an admin to assign one.</p>
          </div>
        ) : (
          <>
            <section className="mt-5 grid md:grid-cols-3 gap-3">
              <Stat label="Awaiting" value={String(orders.data?.filter(o => o.status === "awaiting_shop").length ?? 0)} />
              <Stat label="In progress" value={String(orders.data?.filter(o => ["accepted_by_shop", "packed"].includes(o.status)).length ?? 0)} />
              <Stat label="Delivered today" value={String(orders.data?.filter(o => o.status === "delivered").length ?? 0)} />
            </section>

            {(expiry.data && (expiry.data.expired + expiry.data.week + expiry.data.month) > 0) && (
              <section className="mt-4 rounded-2xl border border-orange-300 bg-orange-50 dark:bg-orange-950/30 p-4 flex items-start gap-3 flex-wrap">
                <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm">⚠ Inventory Alerts</div>
                  <div className="text-xs text-muted-foreground mt-1">
                    {expiry.data.expired > 0 && <span className="mr-3">🔴 <b>{expiry.data.expired}</b> expired</span>}
                    {expiry.data.week > 0 && <span className="mr-3">🟠 <b>{expiry.data.week}</b> expire this week</span>}
                    {expiry.data.month > 0 && <span className="mr-3">🟡 <b>{expiry.data.month}</b> expire this month</span>}
                    {expiry.data.valueAtRisk > 0 && <span>· Value at risk: <b>{rupees(expiry.data.valueAtRisk)}</b></span>}
                  </div>
                </div>
                <Button asChild size="sm" variant="outline" className="rounded-xl">
                  <Link to="/shopkeeper/inventory-insights">View details →</Link>
                </Button>
              </section>
            )}



            <section className="mt-6">
              <h2 className="font-bold mb-3">Live orders</h2>
              <div className="space-y-3">
                {(orders.data ?? []).map(o => (
                  <div key={o.id} className="rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-bold flex items-center gap-2 flex-wrap">
                        {o.order_number}
                        <DeliveryTypeBadge type={(o as any).delivery_type} size="xs" />
                        <span className="text-[10px] uppercase font-bold rounded-full bg-secondary px-2 py-0.5">{String((o as any).payment_method ?? "").toUpperCase()}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {rupees(o.total)} • {o.status.replace(/_/g, " ")} • {itemStats.data?.[o.id]?.products ?? 0} products / {itemStats.data?.[o.id]?.qty ?? 0} items
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {(o.address as any)?.name} {(o.address as any)?.phone ? `· ${(o.address as any).phone}` : ""} — {(o.address as any)?.line1}
                        {(o as any).delivery_pincode ? ` · ${(o as any).delivery_pincode}` : ""}
                        {(o as any).assignment_distance_km != null ? ` · ${Number((o as any).assignment_distance_km).toFixed(1)} km` : ""}
                      </div>
                      <div className="text-[11px] text-muted-foreground">{o.placed_at ? new Date(o.placed_at).toLocaleString() : ""}</div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button asChild size="sm" variant="secondary" className="rounded-xl">
                        <Link to="/shopkeeper/orders/$id" params={{ id: o.id }}>View details</Link>
                      </Button>
                      {o.status === "awaiting_shop" && (
                        <>
                          <Button size="sm" onClick={() => accept(o.id)} className="rounded-xl"><Check className="h-3 w-3 mr-1" />Accept</Button>
                          <Button size="sm" variant="outline" onClick={() => reject(o.id)} className="rounded-xl"><X className="h-3 w-3 mr-1" />Reject</Button>
                        </>
                      )}
                      {o.status === "accepted_by_shop" && (
                        <Button size="sm" onClick={() => pack(o.id)} className="rounded-xl"><PackageCheck className="h-3 w-3 mr-1" />Mark packed</Button>
                      )}
                    </div>
                  </div>
                ))}
                {(orders.data?.length ?? 0) === 0 && <div className="text-sm text-muted-foreground">No orders yet.</div>}
              </div>
            </section>
          </>
        )}
      </div>
    </RoleShell>

  );
}


function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground font-semibold">{label}</div>
      <div className="font-display text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

export { NAV as SHOPKEEPER_NAV };
