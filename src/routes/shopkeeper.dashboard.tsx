import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/format";
import { toast } from "sonner";
import { ListOrdered, Package, Wallet, Bell, Star, Check, X, PackageCheck, Truck, AlertTriangle, ChevronRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { DeliveryTypeBadge } from "@/components/FastDeliveryBadge";
import { runOptimistic, patchRow, removeRow } from "@/lib/optimistic";

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


  const list = orders.data ?? [];
  const awaiting = list.filter((o) => o.status === "awaiting_shop").length;
  const inProgress = list.filter((o) => ["accepted_by_shop", "packed"].includes(o.status)).length;
  const delivered = list.filter((o) => o.status === "delivered").length;
  const active = list.filter((o) => !["delivered", "cancelled", "rejected"].includes(o.status));

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 md:px-6">
        <header className="rounded-xl bg-tint-mint px-4 py-3">
          <h1 className="large-title">Today</h1>
          <p className="mt-0.5 text-small text-foreground/60">Orders and stock at a glance</p>
        </header>

        {shopLoading ? (
          <div className="h-40 rounded-xl shimmer" />
        ) : !shopId ? (
          <EmptyState icon={<Package className="h-6 w-6" />} title="No shop assigned yet" text="Ask an admin to assign a shop to your account." />
        ) : (
          <>
            <section className="grid grid-cols-2 gap-2.5 md:grid-cols-4">
              <Stat label="Awaiting" value={awaiting} tint="bg-tint-sun" icon={<Bell className="h-[18px] w-[18px]" />} />
              <Stat label="In progress" value={inProgress} tint="bg-tint-sky" icon={<Package className="h-[18px] w-[18px]" />} />
              <Stat label="Delivered" value={delivered} tint="bg-tint-mint" icon={<PackageCheck className="h-[18px] w-[18px]" />} />
              <Stat label="Recent orders" value={list.length} tint="bg-tint-violet" icon={<ListOrdered className="h-[18px] w-[18px]" />} />
            </section>

            {expiry.data && expiry.data.expired + expiry.data.week + expiry.data.month > 0 && (
              <Link
                to="/shopkeeper/inventory-insights"
                className="press flex items-center gap-3 rounded-xl bg-tint-sun p-4"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card/70">
                  <AlertTriangle className="h-5 w-5 text-warning-foreground" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="text-body font-semibold">Inventory alerts</div>
                  <div className="truncate text-meta text-foreground/65">
                    {[
                      expiry.data.expired > 0 && `${expiry.data.expired} expired`,
                      expiry.data.week > 0 && `${expiry.data.week} this week`,
                      expiry.data.month > 0 && `${expiry.data.month} this month`,
                      expiry.data.valueAtRisk > 0 && `${rupees(expiry.data.valueAtRisk)} at risk`,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </div>
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-foreground/40" />
              </Link>
            )}

            <section className="space-y-3">
              <div className="flex items-end justify-between">
                <h2 className="section-title">Live orders</h2>
                <Link to="/shopkeeper/orders" className="press text-meta font-semibold text-primary">
                  See all
                </Link>
              </div>
              {active.length === 0 ? (
                <EmptyState icon={<ListOrdered className="h-6 w-6" />} title="No live orders" text="New orders will show up here as they come in." />
              ) : (
                <div className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card border border-border/70">
                  {active.map((o) => (
                    <div key={o.id} className="space-y-2.5 p-3.5">
                      <Link to="/shopkeeper/orders/$id" params={{ id: o.id }} className="block">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-body font-semibold">
                              {o.order_number}
                              <DeliveryTypeBadge type={(o as any).delivery_type} size="xs" />
                            </div>
                            <div className="mt-0.5 text-small text-muted-foreground">
                              {itemStats.data?.[o.id]?.qty ?? 0} items · {String((o as any).payment_method ?? "").toUpperCase()}
                              {(o as any).assignment_distance_km != null ? ` · ${Number((o as any).assignment_distance_km).toFixed(1)} km` : ""}
                            </div>
                          </div>
                          <div className="shrink-0 text-right">
                            <div className="text-body font-semibold">{rupees(o.total)}</div>
                            <span className={`mt-1 inline-block rounded-full px-2.5 py-0.5 text-caption font-semibold capitalize ${statusTint(o.status)}`}>
                              {o.status.replace(/_/g, " ")}
                            </span>
                          </div>
                        </div>
                        <div className="mt-2 truncate text-small text-muted-foreground">
                          {(o.address as any)?.name} — {(o.address as any)?.line1}
                          {(o as any).delivery_pincode ? ` · ${(o as any).delivery_pincode}` : ""}
                        </div>
                      </Link>
                      {o.status === "awaiting_shop" && (
                        <div className="flex gap-2">
                          <Button className="h-10 flex-1" onClick={() => accept(o.id)}>
                            <Check className="mr-1 h-4 w-4" /> Accept
                          </Button>
                          <Button className="h-10 flex-1" variant="secondary" onClick={() => reject(o.id)}>
                            <X className="mr-1 h-4 w-4" /> Reject
                          </Button>
                        </div>
                      )}
                      {o.status === "accepted_by_shop" && (
                        <Button className="h-10 w-full" onClick={() => pack(o.id)}>
                          <PackageCheck className="mr-1 h-4 w-4" /> Mark packed
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </section>

            <section className="space-y-3">
              <h2 className="section-title">Manage</h2>
              <div className="divide-y divide-border/60 overflow-hidden rounded-xl bg-card border border-border/70">
                <QuickLink to="/shopkeeper/products" icon={<Package className="h-[18px] w-[18px]" />} tint="bg-tint-mint" label="Products & stock" />
                <QuickLink to="/shopkeeper/delivery" icon={<Truck className="h-[18px] w-[18px]" />} tint="bg-tint-sky" label="Delivery" />
                <QuickLink to="/shopkeeper/earnings" icon={<Wallet className="h-[18px] w-[18px]" />} tint="bg-tint-sun" label="Earnings" />
                <QuickLink to="/shopkeeper/reviews" icon={<Star className="h-[18px] w-[18px]" />} tint="bg-tint-rose" label="Reviews" />
              </div>
            </section>
          </>
        )}
      </div>
    </>
  );
}

function statusTint(status: string) {
  if (status === "awaiting_shop") return "bg-tint-sun text-warning-foreground";
  if (status === "accepted_by_shop") return "bg-tint-sky text-foreground/80";
  if (status === "packed" || status === "delivered") return "bg-primary-soft text-primary-ink";
  return "bg-secondary text-muted-foreground";
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card px-4 py-8 text-center">
      <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-primary-soft text-primary-ink">{icon}</div>
      <div className="mt-3 text-body font-semibold">{title}</div>
      <p className="mt-1 text-small text-muted-foreground">{text}</p>
    </div>
  );
}

function QuickLink({ to, icon, tint, label }: { to: string; icon: React.ReactNode; tint: string; label: string }) {
  return (
    <Link to={to as any} className="press flex min-h-12 items-center gap-3 px-4 py-2">
      <span className={`grid h-9 w-9 place-items-center rounded-lg ${tint}`}>{icon}</span>
      <span className="flex-1 text-body font-medium">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground/60" />
    </Link>
  );
}

function Stat({ label, value, tint, icon }: { label: string; value: number; tint: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3.5">
      <span className={`grid h-9 w-9 place-items-center rounded-lg ${tint}`}>{icon}</span>
      <div className="mt-2.5 text-xl font-semibold tracking-tight">{value}</div>
      <div className="text-small text-muted-foreground">{label}</div>
    </div>
  );
}
