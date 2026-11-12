import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/RoleShell";
import { rupees } from "@/lib/format";
import { ADMIN_NAV } from "./admin.dashboard";
import { OrderAuditLog } from "@/components/OrderAuditLog";
import { useOrderDetails } from "@/components/order/useOrderDetails";
import { CustomerInfoCard, OrderItemsPanel, OrderMetaStrip, OrderSummaryCard, OrderTimeline } from "@/components/order/OrderPanels";
import { AdminOrderActions } from "@/components/order/AdminOrderActions";

export const Route = createFileRoute("/admin/orders/$id")({
  head: () => ({
    meta: [
      { title: "Order details — AP Mart Admin" },
      { name: "description", content: "Full order breakdown: products, shops, rider, inventory impact, payments and timeline." },
      { property: "og:title", content: "Order details — AP Mart Admin" },
      { property: "og:description", content: "Full order breakdown for AP Mart admins." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const q = useOrderDetails(id, { refetchInterval: 15000 });

  const meta = useQuery({
    queryKey: ["admin-order-meta", id, q.data?.order?.shop_id, q.data?.order?.partner_id],
    enabled: !!q.data,
    queryFn: async () => {
      const o: any = q.data!.order;
      const [shops, partner] = await Promise.all([
        supabase.rpc("admin_list_shops").then((r) => (r.data as any[]) ?? []),
        o.partner_id ? supabase.from("delivery_partners").select("name, phone, vehicle").eq("id", o.partner_id).maybeSingle().then((r) => r.data) : null,
      ]);
      const shopMap = new Map(shops.map((s: any) => [s.id, s]));
      return { shop: o.shop_id ? shopMap.get(o.shop_id) ?? null : null, shopMap, partner };
    },
  });


  if (!q.data)
    return (
      <RoleShell role="admin" nav={ADMIN_NAV} requireRoles={["admin"]}>
        <div className="p-6">{q.isLoading ? "Loading…" : "Order not found."}</div>
      </RoleShell>
    );

  const { order: o, items, children, totalQuantity, productCount } = q.data as any;
  const shopEarnings = Number(o.subtotal ?? 0) - Number(o.discount ?? 0);
  const commission = Math.max(0, Number(o.total ?? 0) - shopEarnings - Number(o.delivery_fee ?? 0) - Number(o.handling_fee ?? 0));

  return (
    <RoleShell role="admin" nav={ADMIN_NAV} requireRoles={["admin"]}>
      <div className="p-4 md:p-6 max-w-5xl space-y-5">
        <div>
          <h1 className="font-display text-2xl font-bold">{o.order_number}</h1>
          <div className="text-sm text-muted-foreground mt-1">{String(o.status).replace(/_/g, " ")} • {rupees(o.total)}</div>
        </div>

        <OrderMetaStrip order={o} />

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h2 className="font-bold mb-2 text-sm">Items & inventory impact</h2>
              <OrderItemsPanel items={items} />
            </div>

            {children.length > 0 && (
              <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
                <div className="font-bold text-sm">Shops on this order ({children.length})</div>
                {children.map((c: any) => {
                  const s: any = c.shop_id ? meta.data?.shopMap?.get(c.shop_id) : null;
                  return (
                    <Link key={c.id} to="/admin/orders/$id" params={{ id: c.id }} className="block py-2 border-t border-border hover:text-primary">
                      <div className="flex justify-between text-sm gap-2">
                        <span className="font-semibold">{s?.name ?? c.order_number}</span>
                        <span className="text-xs uppercase rounded-full bg-secondary px-2 py-0.5 font-bold">{String(c.status).replace(/_/g, " ")}</span>
                        <span className="font-bold">{rupees(c.total)}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {c.order_number} · Owner: {s?.owner_name ?? "—"} · PIN {s?.pincode ?? "—"}
                      </div>
                    </Link>
                  );
                })}
              </div>
            )}

            <div className="rounded-2xl border border-border bg-card p-4 space-y-2 text-sm">
              <div className="font-bold">Assignment & routing</div>
              <div className="grid grid-cols-2 gap-y-1 text-muted-foreground">
                <span>Shop</span><span className="text-foreground">{meta.data?.shop?.name ?? o.shop_id ?? "—"}</span>
                <span>Shop owner</span><span className="text-foreground">{meta.data?.shop?.owner_name ?? "—"}{meta.data?.shop?.owner_phone ? ` · ${meta.data.shop.owner_phone}` : ""}</span>
                <span>Shop PIN code</span><span className="text-foreground">{meta.data?.shop?.pincode ?? "—"}</span>
                <span>Shop ID</span><span className="text-foreground font-mono text-xs">{o.shop_id ?? "—"}</span>
                <span>Delivery partner</span><span className="text-foreground">{meta.data?.partner ? `${meta.data.partner.name} (${meta.data.partner.phone ?? "—"})` : "—"}</span>
                <span>Parent order</span><span className="text-foreground font-mono text-xs">{o.parent_order_id ?? (o.is_parent ? "this order" : "—")}</span>
                <span>Distance</span><span className="text-foreground">{o.assignment_distance_km != null ? `${Number(o.assignment_distance_km).toFixed(2)} km` : "—"}</span>
                <span>Routing status</span><span className="text-foreground">{o.routing_status ?? "—"}</span>
                <span>Reason</span><span className="text-foreground">{o.assignment_reason ?? "—"}</span>
                <span>Attempts</span><span className="text-foreground">{o.assignment_attempts ?? 0}</span>
              </div>
            </div>


            <div className="rounded-2xl border border-border bg-card p-4 space-y-1 text-sm">
              <div className="font-bold mb-1">Financials</div>
              <div className="grid grid-cols-2 gap-y-1 text-muted-foreground">
                <span>Shop earnings</span><span className="text-foreground font-semibold">{rupees(shopEarnings)}</span>
                <span>Platform commission</span><span className="text-foreground font-semibold">{rupees(commission)}</span>
                <span>Delivery fee</span><span className="text-foreground">{rupees(o.delivery_fee ?? 0)}</span>
                <span>Handling fee</span><span className="text-foreground">{rupees(o.handling_fee ?? 0)}</span>
                <span>Coupon</span><span className="text-foreground">{o.coupon_code ?? "—"}</span>
                <span>Payment status</span><span className="text-foreground">{String(o.payment_status).replace(/_/g, " ")}</span>
              </div>
            </div>

            <OrderAuditLog orderId={o.id} />
          </div>

          <div className="space-y-4">
            <AdminOrderActions order={o} />
            <OrderSummaryCard order={o} productCount={productCount} totalQuantity={totalQuantity} />
            <CustomerInfoCard order={o} />
            <OrderTimeline status={o.status} />

          </div>
        </div>
      </div>
    </RoleShell>
  );
}
