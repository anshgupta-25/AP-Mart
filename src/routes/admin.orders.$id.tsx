import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { rupees } from "@/lib/format";
import { OrderAuditLog } from "@/components/OrderAuditLog";
import { useOrderDetails } from "@/components/order/useOrderDetails";
import {
  CustomerInfoCard,
  OrderItemsPanel,
  OrderMetaStrip,
  OrderSummaryCard,
  OrderTimeline,
} from "@/components/order/OrderPanels";
import { AdminOrderActions } from "@/components/order/AdminOrderActions";

export const Route = createFileRoute("/admin/orders/$id")({
  head: () => ({
    meta: [
      { title: "Order details — AP Mart Admin" },
      {
        name: "description",
        content:
          "Full order breakdown: products, shops, rider, inventory impact, payments and timeline.",
      },
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
        o.partner_id
          ? supabase
              .from("delivery_partners")
              .select("name, phone, vehicle")
              .eq("id", o.partner_id)
              .maybeSingle()
              .then((r) => r.data)
          : null,
      ]);
      const shopMap = new Map(shops.map((s: any) => [s.id, s]));
      return { shop: o.shop_id ? (shopMap.get(o.shop_id) ?? null) : null, shopMap, partner };
    },
  });

  if (!q.data)
    return (
      <div className="space-y-4 px-4 py-4 md:px-6 md:py-6">
        {q.isLoading ? (
          <div className="h-40 rounded-xl shimmer" />
        ) : (
          <div className="rounded-xl border border-border/70 bg-card px-6 py-10 text-center">
            <div className="text-subtitle font-semibold">Order not found</div>
          </div>
        )}
      </div>
    );

  const { order: o, items, children, totalQuantity, productCount } = q.data as any;
  const shopEarnings = Number(o.subtotal ?? 0) - Number(o.discount ?? 0);
  const commission = Math.max(
    0,
    Number(o.total ?? 0) - shopEarnings - Number(o.delivery_fee ?? 0) - Number(o.handling_fee ?? 0),
  );

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-4 py-4 md:px-6 md:py-6">
      <div>
        <h1 className="large-title">{o.order_number}</h1>
        <div className="mt-1 text-body capitalize text-muted-foreground">
          {String(o.status).replace(/_/g, " ")} · {rupees(o.total)}
        </div>
      </div>

      <OrderMetaStrip order={o} />

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <div>
            <h2 className="section-title mb-3">Items & inventory impact</h2>
            <OrderItemsPanel items={items} />
          </div>

          {children.length > 0 && (
            <div className="space-y-1 rounded-xl border border-border/70 bg-card p-4">
              <div className="section-title mb-2">Shops on this order ({children.length})</div>
              {children.map((c: any) => {
                const s: any = c.shop_id ? meta.data?.shopMap?.get(c.shop_id) : null;
                return (
                  <Link
                    key={c.id}
                    to="/admin/orders/$id"
                    params={{ id: c.id }}
                    className="press block border-t border-border/70 py-3 hover:text-primary"
                  >
                    <div className="flex justify-between text-sm gap-2">
                      <span className="font-medium">{s?.name ?? c.order_number}</span>
                      <span className="rounded-full bg-secondary px-2.5 py-0.5 text-caption font-semibold capitalize text-muted-foreground">
                        {String(c.status).replace(/_/g, " ")}
                      </span>
                      <span className="font-semibold">{rupees(c.total)}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {c.order_number} · Owner: {s?.owner_name ?? "—"} · PIN {s?.pincode ?? "—"}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}

          <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 text-body">
            <div className="section-title">Assignment & routing</div>
            <div className="grid grid-cols-2 gap-y-2.5 text-muted-foreground">
              <span>Shop</span>
              <span className="text-foreground">{meta.data?.shop?.name ?? o.shop_id ?? "—"}</span>
              <span>Shop owner</span>
              <span className="text-foreground">
                {meta.data?.shop?.owner_name ?? "—"}
                {meta.data?.shop?.owner_phone ? ` · ${meta.data.shop.owner_phone}` : ""}
              </span>
              <span>Shop PIN code</span>
              <span className="text-foreground">{meta.data?.shop?.pincode ?? "—"}</span>
              <span>Shop ID</span>
              <span className="text-foreground font-mono text-xs">{o.shop_id ?? "—"}</span>
              <span>Delivery partner</span>
              <span className="text-foreground">
                {meta.data?.partner
                  ? `${meta.data.partner.name} (${meta.data.partner.phone ?? "—"})`
                  : "—"}
              </span>
              <span>Parent order</span>
              <span className="text-foreground font-mono text-xs">
                {o.parent_order_id ?? (o.is_parent ? "this order" : "—")}
              </span>
              <span>Distance</span>
              <span className="text-foreground">
                {o.assignment_distance_km != null
                  ? `${Number(o.assignment_distance_km).toFixed(2)} km`
                  : "—"}
              </span>
              <span>Routing status</span>
              <span className="text-foreground">{o.routing_status ?? "—"}</span>
              <span>Reason</span>
              <span className="text-foreground">{o.assignment_reason ?? "—"}</span>
              <span>Attempts</span>
              <span className="text-foreground">{o.assignment_attempts ?? 0}</span>
            </div>
          </div>

          <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4 text-body">
            <div className="section-title">Financials</div>
            <div className="grid grid-cols-2 gap-y-2.5 text-muted-foreground">
              <span>Shop earnings</span>
              <span className="text-foreground font-semibold">{rupees(shopEarnings)}</span>
              <span>Platform commission</span>
              <span className="text-foreground font-semibold">{rupees(commission)}</span>
              <span>Delivery fee</span>
              <span className="text-foreground">{rupees(o.delivery_fee ?? 0)}</span>
              <span>Handling fee</span>
              <span className="text-foreground">{rupees(o.handling_fee ?? 0)}</span>
              <span>Coupon</span>
              <span className="text-foreground">{o.coupon_code ?? "—"}</span>
              <span>Payment status</span>
              <span className="text-foreground">{String(o.payment_status).replace(/_/g, " ")}</span>
            </div>
          </div>

          <OrderAuditLog orderId={o.id} />
        </div>

        <div className="space-y-5">
          <AdminOrderActions order={o} />
          <OrderSummaryCard order={o} productCount={productCount} totalQuantity={totalQuantity} />
          <CustomerInfoCard order={o} />
          <OrderTimeline status={o.status} />
        </div>
      </div>
    </div>
  );
}
