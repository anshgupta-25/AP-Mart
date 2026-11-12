import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock, Package, Truck, Home, X, Store, Search, Radio, LifeBuoy } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/format";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { RouteMap } from "@/components/maps/RouteMap";
import { DeliveryUpdates } from "@/components/DeliveryUpdates";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { StorageImg } from "@/components/StorageImg";

const CANCEL_STATUSES = new Set(["placed", "payment_confirmed", "awaiting_shop", "accepted_by_shop"]);
const CANCEL_REASONS = [
  "Ordered by mistake",
  "Wrong delivery address",
  "Changed my mind",
  "Ordered the wrong items",
  "Other",
];

const STEPS = [
  { key: "awaiting_shop", label: "Finding a shop", desc: "Looking for the nearest shop with your items", icon: Search },
  { key: "accepted_by_shop", label: "Shop accepted", desc: "A shop confirmed and is preparing your order", icon: Store },
  { key: "packed", label: "Packed", desc: "Your order is ready for pickup", icon: Package },
  { key: "out_for_delivery", label: "Out for delivery", desc: "A partner is on the way to your door", icon: Truck },
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
      const { data: children } = await supabase.from("orders").select("*, shops(id,name,address,latitude,longitude)").eq("parent_order_id", id);
      const kids = (children ?? []) as any[];
      const itemOrderIds = kids.length > 0 ? kids.map((c) => c.id) : [id];
      const { data: it } = await supabase.from("order_items").select("*").in("order_id", itemOrderIds);
      let shop: any = null, partner: any = null;
      if ((o as any).shop_id) {
        const { data } = await supabase.from("shops").select("id,name,latitude,longitude,address,city").eq("id", (o as any).shop_id).maybeSingle();
        shop = data;
      }
      if ((o as any).partner_id) {
        const { data } = await supabase.rpc("get_order_partner_tracking", { _order_id: id });
        partner = Array.isArray(data) ? data[0] ?? null : data;
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
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, (payload) => {
        const prev = (payload.old as any)?.status;
        const next = (payload.new as any)?.status;
        qc.invalidateQueries({ queryKey: ["order", id] });
        if (prev !== next) {
          const step = STEPS.find((s) => s.key === next);
          if (step) toast.success(step.label, { description: step.desc });
        }
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "delivery_partners" }, () => {
        schedulePartnerInvalidate();
      })
      .subscribe((status) => setLive(status === "SUBSCRIBED"));
    return () => {
      if (partnerInvalidateTimer) clearTimeout(partnerInvalidateTimer);
      supabase.removeChannel(channel);
    };
  }, [id, qc]);

  if (order.isLoading) return <div className="mx-auto max-w-3xl px-4 py-10"><Skeleton className="h-96" /></div>;
  if (!order.data) return <div className="mx-auto max-w-3xl px-4 py-20 text-center">Order not found.</div>;

  const o = order.data;
  const status = o.status as string;
  const currentIdx = Math.max(0, STEPS.findIndex((s) => s.key === status));
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

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <Link to="/customer/orders" className="text-sm text-muted-foreground hover:underline">← All orders</Link>

      <div className="mt-4 rounded-3xl gradient-hero border border-border p-6 shadow-card relative overflow-hidden">
        <div className="text-xs font-semibold text-muted-foreground">Order</div>
        <div className="font-display text-3xl font-extrabold">{o.order_number}</div>
        <div className="text-sm mt-1">Placed {new Date(o.placed_at).toLocaleString()}</div>
        <div className="mt-3 flex items-center gap-2 flex-wrap">
          <div className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-3 py-1 text-xs font-bold">
            <Clock className="h-3 w-3" />
            {isCancelled ? "Cancelled" : isFailed ? "No shop available" : status === "delivered" ? "Delivered" : "Arriving in ~10 minutes"}
          </div>
          {live && !isCancelled && !isFailed && status !== "delivered" && (
            <div className="inline-flex items-center gap-1.5 rounded-full bg-primary/15 text-primary px-3 py-1 text-xs font-bold">
              <motion.span animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                <Radio className="h-3 w-3" />
              </motion.span>
              Live tracking
            </div>
          )}
        </div>
      </div>

      {!isCancelled && !isFailed && (
        <section className="mt-6 rounded-3xl border border-border bg-card p-5 md:p-6 shadow-card">
          <h2 className="font-display text-lg font-bold mb-5">Track order</h2>
          <ol className="relative">
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              const done = i < currentIdx;
              const current = i === currentIdx;
              const isLast = i === STEPS.length - 1;
              return (
                <li key={s.key} className="relative pl-14 pb-6 last:pb-0">
                  {!isLast && (
                    <span className={`absolute left-[19px] top-10 bottom-0 w-0.5 ${done ? "bg-primary" : "bg-border"}`} aria-hidden />
                  )}
                  <motion.div
                    initial={false}
                    animate={{ scale: current ? [1, 1.08, 1] : 1 }}
                    transition={{ duration: 1.4, repeat: current ? Infinity : 0 }}
                    className={`absolute left-0 top-0 h-10 w-10 rounded-full grid place-items-center border-2 ${
                      done || current ? "gradient-primary border-primary text-primary-foreground shadow-glow" : "bg-card border-border text-muted-foreground"
                    }`}
                  >
                    {done ? <Check className="h-5 w-5" /> : <Icon className="h-4 w-4" />}
                  </motion.div>
                  <AnimatePresence>
                    <motion.div
                      key={`${s.key}-${current ? "c" : done ? "d" : "p"}`}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`pt-1 ${current ? "" : done ? "" : "opacity-60"}`}
                    >
                      <div className={`text-sm font-bold ${current ? "text-primary" : ""}`}>{s.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{s.desc}</div>
                      {current && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1 text-[10px] font-bold uppercase tracking-wide text-primary inline-flex items-center gap-1">
                          <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" /> In progress
                        </motion.div>
                      )}
                    </motion.div>
                  </AnimatePresence>
                </li>
              );
            })}
          </ol>
        </section>
      )}

      {!isCancelled && !isFailed && (o.shop || o.partner || o.delivery_lat) && (
        <section className="mt-6 rounded-3xl border border-border bg-card p-5 md:p-6 shadow-card">
          <h2 className="font-display text-lg font-bold mb-3">Route</h2>
          <RouteMap
            height="h-64"
            points={[
              o.partner?.current_lat && o.partner?.current_lng ? { lat: o.partner.current_lat, lng: o.partner.current_lng, label: `Partner: ${o.partner.name}` } : null,
              o.shop?.latitude && o.shop?.longitude ? { lat: o.shop.latitude, lng: o.shop.longitude, label: `Shop: ${o.shop.name}` } : null,
              o.delivery_lat && o.delivery_lng ? { lat: o.delivery_lat, lng: o.delivery_lng, label: "Delivery address" } : null,
            ].filter(Boolean) as { lat: number; lng: number; label: string }[]}
          />
        </section>
      )}

      {!isCancelled && !isFailed && <DeliveryUpdates orderId={id} />}

      {isFailed && (
        <div className="mt-6 rounded-3xl border-2 border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center gap-2 font-bold text-destructive"><X className="h-4 w-4" /> No shop available</div>
          <div className="text-sm text-muted-foreground mt-1">We couldn't find a shop near your location with all items in stock. Your stock has been restored — please try again with a different address.</div>
        </div>
      )}

      {isCancelled && (
        <div className="mt-6 rounded-3xl border-2 border-destructive/30 bg-destructive/5 p-5">
          <div className="flex items-center gap-2 font-bold text-destructive"><X className="h-4 w-4" /> Order cancelled</div>
          {o.cancel_reason && <div className="text-sm text-muted-foreground mt-1">Reason: {o.cancel_reason}</div>}
          {o.cancelled_at && <div className="text-xs text-muted-foreground mt-1">Cancelled on {new Date(o.cancelled_at).toLocaleString()}</div>}
          {(o.payment_status === "refund_initiated" || o.payment_status === "refunded") && (
            <div className="mt-2 inline-flex items-center rounded-full bg-primary/15 text-primary px-3 py-1 text-xs font-bold">
              Refund {o.payment_status === "refunded" ? "completed" : "in progress"}
            </div>
          )}
        </div>
      )}

      {(o as any).children && (o as any).children.length > 1 && (
        <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" /> Delivering from {(o as any).children.length} shops
          </h2>
          <div className="space-y-3">
            {(o as any).children.map((c: any) => {
              const childItems = o.items.filter((it: any) => it.order_id === c.id);
              return (
                <div key={c.id} className="rounded-2xl border border-border p-3">
                  <div className="flex justify-between items-start gap-2">
                    <div className="min-w-0">
                      <div className="text-sm font-bold truncate">{c.shops?.name ?? "Shop"}</div>
                      <div className="text-[11px] text-muted-foreground">
                        {c.status.replace(/_/g, " ")} · {childItems.length} item{childItems.length !== 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="text-sm font-bold">{rupees(c.subtotal)}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      <section className="mt-6 rounded-3xl border border-border bg-card p-5 shadow-card">
        <h2 className="font-display text-lg font-bold mb-3">Items ({o.items.length})</h2>
        <div className="space-y-3">
          {o.items.map((it: any) => (
            <div key={it.id} className="flex items-center gap-3">
              {it.image_url ? (
                <StorageImg loading="lazy" decoding="async" src={it.image_url} className="h-14 w-14 rounded-xl object-cover" alt={it.name} />
              ) : (
                <div className="h-14 w-14 rounded-xl bg-secondary grid place-items-center">🛒</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium line-clamp-1">{it.name}</div>
                <div className="text-xs text-muted-foreground">{it.unit} • Qty {it.quantity}</div>
              </div>
              <div className="font-bold text-sm">{rupees(it.price * it.quantity)}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-6 grid md:grid-cols-2 gap-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-bold mb-2">Bill summary</h3>
          <Row label="Subtotal" value={rupees(o.subtotal)} />
          {o.discount > 0 && <Row label="Discount" value={`- ${rupees(o.discount)}`} className="text-success" />}
          <Row label="Delivery" value={o.delivery_fee === 0 ? "FREE" : rupees(o.delivery_fee)} />
          <Row label="Handling" value={rupees(o.handling_fee)} />
          <div className="h-px bg-border my-2" />
          <Row label="Total paid" value={rupees(o.total)} bold />
          <div className="mt-2 text-xs text-muted-foreground">Payment: {o.payment_method.toUpperCase()} • {o.payment_status}</div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display font-bold mb-2">Delivery to</h3>
          <div className="text-sm">
            <div className="font-medium">{(o.address as any)?.name}</div>
            <div className="text-muted-foreground">
              {(o.address as any)?.line1}, {(o.address as any)?.city}, {(o.address as any)?.state} - {(o.address as any)?.pincode}
            </div>
            <div className="text-muted-foreground mt-1">📞 {(o.address as any)?.phone}</div>
          </div>
        </div>
      </section>

      <div className="mt-6 flex flex-wrap gap-3">
        {canCancel ? (
          <Button
            onClick={() => setCancelOpen(true)}
            disabled={cancelling}
            variant="outline"
            className="rounded-xl border-destructive text-destructive hover:bg-destructive hover:text-destructive-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            Cancel order
          </Button>
        ) : !isCancelled && !isFailed ? (
          <div className="w-full rounded-2xl border border-border bg-muted/40 p-4">
            <p className="text-sm text-muted-foreground">
              This order can no longer be cancelled because preparation or delivery has already started.
              If you need help, please contact Support.
            </p>
            <Button
              variant="outline"
              className="rounded-xl mt-3"
              onClick={() => navigate({ to: "/support" })}
            >
              <LifeBuoy className="h-4 w-4 mr-1" />
              Contact Support
            </Button>
          </div>
        ) : null}
        <Button variant="outline" className="rounded-xl" onClick={() => navigate({ to: "/products" })}>Shop more</Button>
      </div>

      <Dialog open={cancelOpen} onOpenChange={(v) => { setCancelOpen(v); if (!v) { setReason(""); setCustomReason(""); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Cancel order {o.order_number}?</DialogTitle>
            <DialogDescription>
              Please tell us why you're cancelling. Your reserved stock will be released
              {(o.payment_status === "paid" && o.payment_method !== "cod") ? " and a refund will be initiated" : ""}.
            </DialogDescription>
          </DialogHeader>
          <RadioGroup value={reason} onValueChange={setReason} className="space-y-2 py-2">
            {CANCEL_REASONS.map((r) => (
              <div key={r} className="flex items-center gap-2 rounded-xl border border-border p-3 cursor-pointer hover:bg-muted/50"
                   onClick={() => setReason(r)}>
                <RadioGroupItem value={r} id={`r-${r}`} />
                <Label htmlFor={`r-${r}`} className="cursor-pointer flex-1 text-sm">{r}</Label>
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
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={cancelling}>Keep order</Button>
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

function Row({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={`flex justify-between text-sm py-0.5 ${bold ? "font-bold text-base" : ""} ${className ?? ""}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
