import { ArrowRight, ImageOff, MapPin, Phone, Printer, User } from "lucide-react";
import { rupees } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { DeliveryTypeBadge } from "@/components/FastDeliveryBadge";
import { stockTone, type EnrichedItem } from "./useOrderDetails";
import { StorageImg } from "@/components/StorageImg";

/* ---------------- Items with inventory impact ---------------- */

export function OrderItemsPanel({ items }: { items: EnrichedItem[] }) {
  if (!items.length)
    return (
      <div className="rounded-xl border border-border/70 bg-card p-4 text-meta text-muted-foreground">
        No items on this order.
      </div>
    );
  return (
    <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card">
      {items.map((it) => {
        const tone = stockTone(it.stockAfter);
        return (
          <div key={it.id} className="flex gap-3 p-3">
            <div className="h-12 w-12 shrink-0 rounded-lg bg-secondary overflow-hidden flex items-center justify-center">
              {it.image ? (
                <StorageImg
                  src={it.image}
                  alt={it.name}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover"
                />
              ) : (
                <ImageOff className="h-4 w-4 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                  <div className="truncate text-meta font-semibold leading-tight">{it.name}</div>
                  <div className="mt-0.5 flex flex-wrap gap-x-2 text-caption text-muted-foreground">
                    {it.brand && <span>{it.brand}</span>}
                    {it.category && <span>· {it.category}</span>}
                    {(it.variantLabel || it.size || it.unit) && (
                      <span>· {[it.variantLabel, it.size, it.unit].filter(Boolean).join(" ")}</span>
                    )}
                    {it.sku && <span className="font-mono">· {it.sku}</span>}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-meta font-semibold">{rupees(it.total)}</div>
                  <div className="text-caption text-muted-foreground">
                    {rupees(it.price)} × {it.quantity}
                  </div>
                </div>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-caption">
                <span className="rounded-full bg-secondary px-2 py-0.5 font-medium">
                  Qty {it.quantity}
                </span>
                {it.stockBefore != null ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 font-medium">
                    Stock{" "}
                    {it.alreadyDeducted ? (
                      <b className="ml-1">{it.stockBefore}</b>
                    ) : (
                      <>
                        <b>{it.stockBefore}</b> <ArrowRight className="h-3 w-3" />{" "}
                        <b>{it.stockAfter}</b>
                      </>
                    )}
                  </span>
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                    Stock n/a
                  </span>
                )}
                <span className={`rounded-full px-2 py-0.5 font-medium ${tone.cls}`}>
                  {tone.dot} {tone.label}
                </span>
                {it.alreadyDeducted && (
                  <span className="text-muted-foreground">already deducted</span>
                )}
              </div>

              {it.stockAfter != null && it.stockAfter <= 0 && (
                <div className="mt-2 text-caption font-medium text-destructive">
                  Out of stock after this order — restock recommended.
                </div>
              )}
              {it.stockAfter != null && it.stockAfter > 0 && it.stockAfter <= 5 && (
                <div className="mt-2 text-caption font-medium text-warning-foreground">
                  Low stock after this order — consider restocking.
                </div>
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
    <div className={`flex justify-between ${strong ? "text-body font-bold" : "text-meta"}`}>
      <span className={strong ? "" : "text-muted-foreground"}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function OrderSummaryCard({
  order,
  productCount,
  totalQuantity,
}: {
  order: any;
  productCount: number;
  totalQuantity: number;
}) {
  return (
    <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4">
      <div className="section-title">Order summary</div>
      <div className="flex gap-2 text-caption text-muted-foreground">
        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-foreground">
          {productCount} products
        </span>
        <span className="rounded-full bg-secondary px-2 py-0.5 font-medium text-foreground">
          {totalQuantity} items
        </span>
      </div>
      <div className="pt-2 space-y-1.5">
        <Row label="Item total" value={rupees(order.subtotal ?? 0)} />
        {Number(order.discount) > 0 && (
          <Row
            label={order.coupon_code ? `Discount (${order.coupon_code})` : "Discount"}
            value={`- ${rupees(order.discount)}`}
          />
        )}
        <Row label="Delivery fee" value={rupees(order.delivery_fee ?? 0)} />
        {Number(order.fast_delivery_fee) > 0 && (
          <Row label="Priority fee" value={rupees(order.fast_delivery_fee)} />
        )}
        <Row label="Handling fee" value={rupees(order.handling_fee ?? 0)} />
        <Row label="Taxes" value={rupees(order.tax ?? 0)} />
        <div className="border-t border-border/60 pt-2">
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
    <div className="space-y-2 rounded-xl border border-border/70 bg-card p-4 text-meta">
      <div className="section-title">Customer</div>
      <div className="flex items-center gap-2">
        <User className="h-4 w-4 text-muted-foreground" />
        {a.name ?? "—"}
      </div>
      <div className="flex items-center gap-2">
        <Phone className="h-4 w-4 text-muted-foreground" />
        {phone ?? "—"}
      </div>
      <div className="flex items-start gap-2">
        <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
        <span className="text-muted-foreground">
          {[a.line1, a.line2, a.landmark, a.city, a.state].filter(Boolean).join(", ")}{" "}
          {a.pincode ? `— ${a.pincode}` : ""}
        </span>
      </div>
      {order.delivery_instruction && (
        <div className="text-muted-foreground">Note: {order.delivery_instruction}</div>
      )}
      <div className="flex gap-2 pt-1 flex-wrap">
        {phone && (
          <Button asChild size="sm" variant="secondary">
            <a href={`tel:${phone}`}>
              <Phone className="h-3 w-3 mr-1" />
              Call
            </a>
          </Button>
        )}
        <Button size="sm" variant="secondary" onClick={() => window.print()}>
          <Printer className="h-3 w-3 mr-1" />
          Print invoice
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
    [
      "Payment",
      `${String(order.payment_method ?? "").toUpperCase()} · ${String(order.payment_status ?? "").replace(/_/g, " ")}`,
    ],
    ["PIN code", order.delivery_pincode ?? a.pincode ?? "—"],
    [
      "Distance",
      order.assignment_distance_km != null
        ? `${Number(order.assignment_distance_km).toFixed(2)} km`
        : "—",
    ],
    ["ETA", order.prep_time_minutes ? `${order.prep_time_minutes} min prep` : "—"],
  ];
  return (
    <div className="flex flex-wrap gap-2">
      <DeliveryTypeBadge type={order.delivery_type} size="sm" />
      {chips.map(([k, v]) => (
        <span key={k} className="rounded-full bg-secondary px-2.5 py-1 text-caption font-medium">
          <span className="text-muted-foreground">{k}: </span>
          {v}
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
  const order = [
    "placed",
    "payment_confirmed",
    "awaiting_shop",
    "accepted_by_shop",
    "packing",
    "packed",
    "out_for_delivery",
    "delivered",
  ];
  const currentIdx = order.indexOf(status);
  const reached = (key: string) => currentIdx >= order.indexOf(key);
  if (status === "cancelled" || status === "no_shop_available") {
    return (
      <div className="rounded-xl border border-border/70 bg-card p-3 text-meta font-semibold text-destructive">
        Order {status.replace(/_/g, " ")}
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3">
      <div className="font-bold mb-3 text-sm">Order timeline</div>
      <ol className="space-y-0">
        {STEPS.map((s, i) => {
          const done = reached(s.key);
          return (
            <li key={s.key} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={`h-3 w-3 rounded-full ${done ? "bg-primary" : "bg-muted"}`} />
                {i < STEPS.length - 1 && (
                  <span className={`w-0.5 flex-1 min-h-6 ${done ? "bg-primary/50" : "bg-muted"}`} />
                )}
              </div>
              <span className={`pb-4 text-sm ${done ? "font-semibold" : "text-muted-foreground"}`}>
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
