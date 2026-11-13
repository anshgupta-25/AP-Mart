import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  Check,
  Clock,
  Package,
  Truck,
  Home,
  X,
  Store,
  Search,
  Radio,
  LifeBuoy,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/format";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteMap } from "@/components/maps/RouteMap";
import { DeliveryUpdates } from "@/components/DeliveryUpdates";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StorageImg } from "@/components/StorageImg";

const CANCEL_STATUSES = new Set([
  "placed",
  "payment_confirmed",
  "awaiting_shop",
  "accepted_by_shop",
]);
const CANCEL_REASONS = [
  "Ordered by mistake",
  "Wrong delivery address",
  "Changed my mind",
  "Ordered the wrong items",
  "Other",
];

const STEPS = [
  {
    key: "awaiting_shop",
    label: "Finding a shop",
    desc: "Looking for the nearest shop with your items",
    icon: Search,
  },
  {
    key: "accepted_by_shop",
    label: "Shop accepted",
    desc: "A shop confirmed and is preparing your order",
    icon: Store,
  },
  { key: "packed", label: "Packed", desc: "Your order is ready for pickup", icon: Package },
  {
    key: "out_for_delivery",
    label: "Out for delivery",
    desc: "A partner is on the way to your door",
    icon: Truck,
  },
  { key: "delivered", label: "Delivered", desc: "Enjoy your order!", icon: Home },
];

export function OrderDetailView({ id }: { id: string }) {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [cancelling, setCancelling] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState<string>("");
  const [customReason, setCustomReason] = useState("");
  const [live, setLive] = useState(false);

  const order = useQuery({
    queryKey: ["order", id],
    queryFn: async () => {
      const { data: o } = await supabase.from("orders").select("*").eq("id", id).maybeSingle();
      if (!o) return null;
      // Fetch children (if parent) + all their items
      const { data: children } = await supabase
        .from("orders")
        .select("*, shops(id,name,address,latitude,longitude)")
        .eq("parent_order_id", id);
      const kids = (children ?? []) as any[];
      const itemOrderIds = kids.length > 0 ? kids.map((c) => c.id) : [id];
      const { data: it } = await supabase
        .from("order_items")
        .select("*")
        .in("order_id", itemOrderIds);
      let shop: any = null,
        partner: any = null;
      if ((o as any).shop_id) {
        const { data } = await supabase
          .from("shops")
          .select("id,name,latitude,longitude,address,city")
          .eq("id", (o as any).shop_id)
          .maybeSingle();
        shop = data;
      }
      if ((o as any).partner_id) {
        const { data } = await supabase.rpc("get_order_partner_tracking", { _order_id: id });
        partner = Array.isArray(data) ? (data[0] ?? null) : data;
      }
      return { ...o, items: it ?? [], shop, partner, children: kids };
    },
  });

  useEffect(() => {
    let partnerInvalidateTimer: ReturnType<typeof setTimeout> | null = null;
    const schedulePartnerInvalidate = () => {
      if (partnerInvalidateTimer) return;
      partnerInvalidateTimer = setTimeout(() => {
        partnerInvalidateTimer = null;
        qc.invalidateQueries({ queryKey: ["order", id] });
      }, 8000);
    };
    const channel = supabase
      .channel(`order-${id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` },
        (payload) => {
          const prev = (payload.old as any)?.status;
          const next = (payload.new as any)?.status;
          qc.invalidateQueries({ queryKey: ["order", id] });
          if (prev !== next) {
            const step = STEPS.find((s) => s.key === next);
            if (step) toast.success(step.label, { description: step.desc });
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "delivery_partners" },
        () => {
          schedulePartnerInvalidate();
        },
      )
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      if (partnerInvalidateTimer) clearTimeout(partnerInvalidateTimer);
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  if (order.isLoading)
    return (
      <div className="mx-auto max-w-3xl px-4 py-6">
        <Skeleton className="h-80 rounded-xl" />
      </div>
    );
  if (!order.data)
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center text-meta text-muted-foreground">
        Order not found.
      </div>
    );

  const o = order.data;
  const status = o.status as string;
  const currentIdx = Math.max(
    0,
    STEPS.findIndex((s) => s.key === status),
  );
  const isCancelled = status === "cancelled";
  const isFailed = status === "no_shop_available";
  const canCancel = CANCEL_STATUSES.has(status);

  const submitCancel = async () => {
    const finalReason = reason === "Other" ? customReason.trim() : reason;
    if (!finalReason) {
      toast.error("Please select a reason");
      return;
    }
    setCancelling(true);
    const { error } = await supabase.rpc("cancel_order", { _order_id: id, _reason: finalReason });
    setCancelling(false);
    if (error) return toast.error(error.message);
    toast.success("Order cancelled");
    setCancelOpen(false);
    setReason("");
    setCustomReason("");
    qc.invalidateQueries({ queryKey: ["order", id] });
    qc.invalidateQueries({ queryKey: ["orders"] });
    qc.invalidateQueries({ queryKey: ["app-orders"] });
  };

  const statusText = isCancelled
    ? "Cancelled"
    : isFailed
      ? "No shop available"
      : status === "delivered"
        ? "Delivered"
        : (STEPS[currentIdx]?.label ?? "In progress");
  const statusTone =
    isCancelled || isFailed
      ? "bg-destructive/10 text-destructive"
      : status === "delivered"
        ? "bg-primary-soft text-primary-ink"
        : "bg-tint-sun text-warning-foreground";
  const card = "rounded-xl border border-border/70 bg-card p-4";

  return (
    <div className="mx-auto max-w-3xl space-y-3 px-4 pb-10 pt-4">
      <Link to="/customer/orders" className="press inline-block text-meta font-medium text-primary">
        ← All orders
      </Link>

      <div className={card}>
        <div className="eyebrow">Order</div>
        <h1 className="large-title mt-1">{o.order_number}</h1>
        <div className="mt-1 text-small text-muted-foreground">
          Placed {new Date(o.placed_at).toLocaleString()}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-caption font-semibold ${statusTone}`}
          >
            <Clock className="h-3 w-3" />
            {statusText}
          </span>
          {live && !isCancelled && !isFailed && status !== "delivered" && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-soft px-2.5 py-1 text-caption font-semibold text-primary-ink">
              <Radio className="h-3 w-3 animate-pulse" />
              Live tracking
            </span>
          )}
        </div>
      </div>

      {!isCancelled && !isFailed && (
        <section className={card}>
          <h2 className="section-title mb-4">Order status</h2>
          <ol className="relative">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < currentIdx;
              const current = i === currentIdx;
              const isLast = i === STEPS.length - 1;
              return (
                <li key={s.key} className="relative pb-5 pl-11 last:pb-0">
                  {!isLast && (
                    <span
                      className={`absolute left-[15px] top-8 bottom-0 w-0.5 ${done ? "bg-primary" : "bg-border"}`}
                      aria-hidden
                    />
                  )}
                  <div
                    className={`absolute left-0 top-0 grid h-8 w-8 place-items-center rounded-full ${
                      done
                        ? "bg-primary text-primary-foreground"
                        : current
                          ? "bg-primary-soft text-primary-ink ring-1 ring-primary"
                          : "bg-secondary text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-4 w-4" /> : <Icon className="h-3.5 w-3.5" />}
                  </div>
                  <div className={`pt-0.5 ${!current && !done ? "opacity-60" : ""}`}>
                    <div className={`text-meta font-semibold ${current ? "text-primary-ink" : ""}`}>
                      {s.label}
                    </div>
                    <div className="mt-0.5 text-caption text-muted-foreground">{s.desc}</div>
                    {current && (
                      <div className="mt-1 inline-flex items-center gap-1.5 text-caption font-medium text-primary">
                        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" /> In
                        progress
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {!isCancelled && !isFailed && (o.shop || o.partner || o.delivery_lat) && (
        <section className={card}>
          <h2 className="section-title mb-3">Route</h2>
          <div className="overflow-hidden rounded-lg">
            <RouteMap
              height="h-52"
              points={
                [
                  o.partner?.current_lat && o.partner?.current_lng
                    ? {
                        lat: o.partner.current_lat,
                        lng: o.partner.current_lng,
                        label: `Partner: ${o.partner.name}`,
                      }
                    : null,
                  o.shop?.latitude && o.shop?.longitude
                    ? { lat: o.shop.latitude, lng: o.shop.longitude, label: `Shop: ${o.shop.name}` }
                    : null,
                  o.delivery_lat && o.delivery_lng
                    ? { lat: o.delivery_lat, lng: o.delivery_lng, label: "Delivery address" }
                    : null,
                ].filter(Boolean) as { lat: number; lng: number; label: string }[]
              }
            />
          </div>
        </section>
      )}

      {!isCancelled && !isFailed && <DeliveryUpdates orderId={id} />}

      {isFailed && (
        <div className="rounded-xl bg-destructive/10 p-4">
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <X className="h-4 w-4" /> No shop available
          </div>
          <div className="mt-1 text-small text-muted-foreground">
            We couldn't find a shop near your location with all items in stock. Your stock has been
            restored — please try again with a different address.
          </div>
        </div>
      )}

      {isCancelled && (
        <div className="rounded-xl bg-destructive/10 p-4">
          <div className="flex items-center gap-2 font-semibold text-destructive">
            <X className="h-4 w-4" /> Order cancelled
          </div>
          {o.cancel_reason && (
            <div className="mt-1 text-small text-muted-foreground">Reason: {o.cancel_reason}</div>
          )}
          {o.cancelled_at && (
            <div className="mt-1 text-caption text-muted-foreground">
              Cancelled on {new Date(o.cancelled_at).toLocaleString()}
            </div>
          )}
          {(o.payment_status === "refund_initiated" || o.payment_status === "refunded") && (
            <div className="mt-3 inline-flex items-center rounded-full bg-primary-soft px-2.5 py-1 text-caption font-semibold text-primary-ink">
              Refund {o.payment_status === "refunded" ? "completed" : "in progress"}
            </div>
          )}
        </div>
      )}

      {(o as any).children && (o as any).children.length > 1 && (
        <section className={card}>
          <h2 className="section-title mb-3 flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" /> Delivering from {(o as any).children.length}{" "}
            shops
          </h2>
          <div className="divide-y divide-border/60">
            {(o as any).children.map((c: any) => {
              const childItems = o.items.filter((it: any) => it.order_id === c.id);
              return (
                <div
                  key={c.id}
                  className="flex items-start justify-between gap-2 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <div className="truncate text-meta font-medium">{c.shops?.name ?? "Shop"}</div>
                    <div className="mt-0.5 text-caption capitalize text-muted-foreground">
                      {c.status.replace(/_/g, " ")} · {childItems.length} item
                      {childItems.length !== 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="text-meta font-semibold">{rupees(c.subtotal)}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className={card}>
        <h2 className="section-title mb-3">Items ({o.items.length})</h2>
        <div className="divide-y divide-border/60">
          {o.items.map((it: any) => (
            <div key={it.id} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
              {it.image_url ? (
                <StorageImg
                  loading="lazy"
                  decoding="async"
                  src={it.image_url}
                  className="h-12 w-12 rounded-lg bg-secondary/70 object-cover"
                  alt={it.name}
                />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-lg bg-secondary text-muted-foreground">
                  <Package className="h-5 w-5" strokeWidth={1.6} />
                </div>
              )}
              <div className="min-w-0 flex-1">
                <div className="line-clamp-1 text-meta font-medium">{it.name}</div>
                <div className="mt-0.5 text-caption text-muted-foreground">
                  {it.unit} · Qty {it.quantity}
                </div>
              </div>
              <div className="text-meta font-semibold">{rupees(it.price * it.quantity)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 md:grid-cols-2">
        <div className={card}>
          <h3 className="section-title mb-3">Bill details</h3>
          <Row label="Subtotal" value={rupees(o.subtotal)} />
          {o.discount > 0 && (
            <Row label="Discount" value={`- ${rupees(o.discount)}`} className="text-success" />
          )}
          <Row label="Delivery" value={o.delivery_fee === 0 ? "Free" : rupees(o.delivery_fee)} />
          <Row label="Handling" value={rupees(o.handling_fee)} />
          <div className="my-2 h-px bg-border/60" />
          <Row label="Total paid" value={rupees(o.total)} bold />
          <div className="mt-2 text-caption capitalize text-muted-foreground">
            Payment: {o.payment_method} · {o.payment_status}
          </div>
        </div>
        <div className={card}>
          <h3 className="section-title mb-3">Delivered to</h3>
          <div className="text-meta">
            <div className="font-medium">{(o.address as any)?.name}</div>
            <div className="mt-0.5 text-muted-foreground">
              {(o.address as any)?.line1}, {(o.address as any)?.city}, {(o.address as any)?.state} -{" "}
              {(o.address as any)?.pincode}
            </div>
            <div className="mt-1 text-muted-foreground">{(o.address as any)?.phone}</div>
          </div>
        </div>
      </section>

      <div className="space-y-2.5">
        {canCancel ? (
          <Button
            onClick={() => setCancelOpen(true)}
            disabled={cancelling}
            variant="secondary"
            className="h-11 w-full rounded-xl text-destructive"
          >
            <X className="mr-1 h-4 w-4" />
            Cancel order
          </Button>
        ) : !isCancelled && !isFailed ? (
          <div className="rounded-xl bg-secondary/70 p-4">
            <p className="text-small text-muted-foreground">
              This order can no longer be cancelled because preparation or delivery has already
              started. If you need help, please contact Support.
            </p>
            <Button variant="outline" className="mt-3" onClick={() => navigate({ to: "/support" })}>
              <LifeBuoy className="mr-1 h-4 w-4" />
              Contact support
            </Button>
          </div>
        ) : null}
        <Button className="h-11 w-full rounded-xl" onClick={() => navigate({ to: "/products" })}>
          Shop more
        </Button>
      </div>

      <Dialog
        open={cancelOpen}
        onOpenChange={(v) => {
          setCancelOpen(v);
          if (!v) {
            setReason("");
            setCustomReason("");
          }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel order {o.order_number}?</DialogTitle>
            <DialogDescription>
              Please tell us why you're cancelling. Your reserved stock will be released
              {o.payment_status === "paid" && o.payment_method !== "cod"
                ? " and a refund will be initiated"
                : ""}
              .
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2 py-2">
            {CANCEL_REASONS.map((r) => (
              <div
                key={r}
                className="flex cursor-pointer items-center gap-3 rounded-lg bg-secondary/60 p-3 hover:bg-secondary"
                onClick={() => setReason(r)}
              >
                <RadioGroupItem value={r} id={`r-${r}`} />
                <Label htmlFor={`r-${r}`} className="flex-1 cursor-pointer text-meta">
                  {r}
                </Label>
              </div>
            ))}
          </RadioGroup>
          {reason === "Other" && (
            <Textarea
              placeholder="Tell us more (required)"
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              maxLength={280}
            />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>
              Keep order
            </Button>
            <Button
              variant="destructive"
              onClick={submitCancel}
              disabled={cancelling || !reason || (reason === "Other" && !customReason.trim())}
            >
              {cancelling ? "Cancelling…" : "Confirm cancel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  className,
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex justify-between py-1 text-meta ${bold ? "text-body font-semibold" : "text-muted-foreground"} ${className ?? ""}`}
    >
      <span>{label}</span>
      <span className={bold || className ? "" : "text-foreground"}>{value}</span>
    </div>
  );
}
