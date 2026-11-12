import { ArrowRight, ImageOff, MapPin, Phone, Printer, User } from "lucide-react";
import { rupees } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DeliveryTypeBadge } from "@/components/FastDeliveryBadge";
import { stockTone, type EnrichedItem } from "./useOrderDetails";
import { StorageImg } from "@/components/StorageImg";

/* ---------------- Items with inventory impact ---------------- */

export function OrderItemsPanel({ items }: { items: EnrichedItem[] }) {
  if (!items.length) return <div className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">No items on this order.</div>;
  return (
    <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
      {items.map((it) => {
        const tone = stockTone(it.stockAfter);
        return (
          <div key={it.id} className="p-3 sm:p-4 flex gap-3">
            <div className="h-16 w-16 shrink-0 rounded-xl bg-secondary overflow-hidden flex items-center justify-center">
              {it.image ? (
                <StorageImg src={it.image} alt={it.name} loading="lazy" decoding="async" className="h-full w-full object-cover" />
              ) : (
                <ImageOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="font-bold leading-tight truncate">{it.name}</div>
                  <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-2">
                    {it.brand && <span>{it.brand}</span>}
                    {it.category && <span>· {it.category}</span>}
                    {(it.variantLabel || it.size || it.unit) && <span>· {[it.variantLabel, it.size, it.unit].filter(Boolean).join(" ")}</span>}
                    {it.sku && <span className="font-mono">· {it.sku}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-extrabold">{rupees(it.total)}</div>
                  <div className="text-xs text-muted-foreground">{rupees(it.price)} × {it.quantity}</div>
                </div>
              </div>

              <div className="mt-2 flex items-center gap-2 flex-wrap text-xs">
                <span className="rounded-full bg-secondary px-2 py-1 font-bold">Qty {it.quantity}</span>
                {it.stockBefore != null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-1 font-semibold">
                    Stock {it.alreadyDeducted ? (
                      <b className="ml-1">{it.stockBefore}</b>
                    ) : (
                      <>
                        <b>{it.stockBefore}</b> <ArrowRight className="h-3 w-3" /> <b>{it.stockAfter}</b>
                      </>
                    )}
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-1 text-muted-foreground">Stock n/a</span>
                )}
                <span className={`rounded-full px-2 py-1 font-bold ${tone.cls}`}>{tone.dot} {tone.label}</span>
                {it.alreadyDeducted && <span className="text-muted-foreground">already deducted</span>}
              </div>

              {it.stockAfter != null && it.stockAfter <= 0 && (
                <div className="mt-2 text-xs font-bold text-destructive">❌ Out of stock after this order — restock recommended.</div>
              )}
              {it.stockAfter != null && it.stockAfter > 0 && it.stockAfter <= 5 && (
                <div className="mt-2 text-xs font-bold text-orange-600">⚠ Low stock after this order — consider restocking.</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Order summary ---------------- */

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex justify-between ${strong ? "text-base font-extrabold" : "text-sm"}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function OrderSummaryCard({ order, productCount, totalQuantity }: { order: any; productCount: number; totalQuantity: number }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2">
      <div className="font-bold">Order summary</div>
      <div className="flex gap-2 text-xs text-muted-foreground">
        <span className="rounded-full bg-secondary px-2 py-1 font-bold text-foreground">{productCount} products</span>
        <span className="rounded-full bg-secondary px-2 py-1 font-bold text-foreground">{totalQuantity} items</span>
      </div>
      <div className="pt-2 space-y-1.5">
        <Row label="Item total" value={rupees(order.subtotal ?? 0)} />
        {Number(order.discount) > 0 && <Row label={order.coupon_code ? `Discount (${order.coupon_code})` : "Discount"} value={`- ${rupees(order.discount)}`} />}
        <Row label="Delivery fee" value={rupees(order.delivery_fee ?? 0)} />
        {Number(order.fast_delivery_fee) > 0 && <Row label="Priority fee" value={rupees(order.fast_delivery_fee)} />}
        <Row label="Handling fee" value={rupees(order.handling_fee ?? 0)} />
        <Row label="Taxes" value={rupees(order.tax ?? 0)} />
        <div className="border-t border-border pt-2">
          <Row label="Grand total" value={rupees(order.total ?? 0)} strong />
        </div>
      </div>
    </div>
  );
}

/* ---------------- Customer info ---------------- */

export function CustomerInfoCard({ order }: { order: any }) {
  const a = (order.address ?? {}) as any;
  const phone = a.phone as string | undefined;
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-2 text-sm">
      <div className="font-bold">Customer</div>
      <div className="flex items-center gap-2"><User className="h-4 w-4 text-muted-foreground" />{a.name ?? "—"}</div>
      <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" />{phone ?? "—"}</div>
      <div className="flex items-start gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <span className="text-muted-foreground">
          {[a.line1, a.line2, a.landmark, a.city, a.state].filter(Boolean).join(", ")} {a.pincode ? `— ${a.pincode}` : ""}
        </span>
      </div>
      {order.delivery_instruction && <div className="text-muted-foreground">📝 {order.delivery_instruction}</div>}
      <div className="flex gap-2 pt-1 flex-wrap">
        {phone && (
          <Button asChild size="sm" variant="outline" className="rounded-xl">
            <a href={`tel:${phone}`}><Phone className="h-3 w-3 mr-1" />Call</a>
          </Button>
        )}
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.print()}>
          <Printer className="h-3 w-3 mr-1" />Print invoice
        </Button>
      </div>
    </div>
  );
}

/* ---------------- Meta strip ---------------- */

export function OrderMetaStrip({ order }: { order: any }) {
  const a = (order.address ?? {}) as any;
  const chips: [string, string][] = [
    ["Placed", order.placed_at ? new Date(order.placed_at).toLocaleString() : "—"],
    ["Payment", `${String(order.payment_method ?? "").toUpperCase()} · ${String(order.payment_status ?? "").replace(/_/g, " ")}`],
    ["PIN code", order.delivery_pincode ?? a.pincode ?? "—"],
    ["Distance", order.assignment_distance_km != null ? `${Number(order.assignment_distance_km).toFixed(2)} km` : "—"],
    ["ETA", order.prep_time_minutes ? `${order.prep_time_minutes} min prep` : "—"],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      <DeliveryTypeBadge type={order.delivery_type} size="sm" />
      {chips.map(([k, v]) => (
        <span key={k} className="rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold">
          <span className="text-muted-foreground">{k}: </span>{v}
        </span>
      ))}
    </div>
  );
}

/* ---------------- Timeline ---------------- */

const STEPS: { key: string; label: string }[] = [
  { key: "placed", label: "Order received" },
  { key: "accepted_by_shop", label: "Accepted" },
  { key: "packed", label: "Ready" },
  { key: "out_for_delivery", label: "Picked up" },
  { key: "delivered", label: "Delivered" },
];

export function OrderTimeline({ status }: { status: string }) {
  const order = ["placed", "payment_confirmed", "awaiting_shop", "accepted_by_shop", "packing", "packed", "out_for_delivery", "delivered"];
  const currentIdx = order.indexOf(status);
  const reached = (key: string) => currentIdx >= order.indexOf(key);
  if (status === "cancelled" || status === "no_shop_available") {
    return <div className="rounded-2xl border border-border bg-card p-4 text-sm font-bold text-destructive">Order {status.replace(/_/g, " ")}</div>;
  }
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="font-bold mb-3 text-sm">Order timeline</div>
      <ol className="space-y-0">
        {STEPS.map((s, i) => {
          const done = reached(s.key);
          return (
            <li key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={`h-3 w-3 rounded-full ${done ? "bg-primary" : "bg-muted"}`} />
                {i < STEPS.length - 1 && <span className={`w-0.5 flex-1 min-h-6 ${done ? "bg-primary/50" : "bg-muted"}`} />}
              </div>
              <span className={`pb-4 text-sm ${done ? "font-semibold" : "text-muted-foreground"}`}>{s.label}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
