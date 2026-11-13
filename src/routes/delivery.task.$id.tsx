import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { RouteMap } from "@/components/maps/RouteMap";
import { rupees } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Package, Phone, Store } from "lucide-react";
import { MultiShopPickupPanel } from "@/components/MultiShopPickupPanel";
import { DeliveryTypeBadge } from "@/components/FastDeliveryBadge";

export const Route = createFileRoute("/delivery/task/$id")({
  head: () => ({ meta: [{ title: "Delivery Task — AP Mart" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const router = useRouter();
  const [etaMin, setEtaMin] = useState<string>("10");
  const [customMsg, setCustomMsg] = useState<string>("");
  const [sending, setSending] = useState(false);

  const sendUpdate = async (
    kind: "eta" | "nearby" | "delay" | "custom",
    minutes?: number,
    message?: string,
  ) => {
    setSending(true);
    const { error } = await supabase.rpc("partner_send_eta_update" as any, {
      _order_id: id,
      _kind: kind,
      _eta_minutes: minutes ?? null,
      _custom_message: message ?? null,
    });
    setSending(false);
    if (error) return toast.error(error.message);
    toast.success("Customer notified");
    if (kind === "custom") setCustomMsg("");
  };

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["delivery-task", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, order_items!order_items_order_id_fkey(*), shops(name,address,latitude,longitude,phone)",
        )
        .eq("id", id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const pickUp = async () => {
    const { error } = await supabase.rpc("partner_accept_order", { _order_id: id });
    if (error) return toast.error(error.message);
    toast.success("Marked as picked up");
    refetch();
  };
  const deliver = async () => {
    const { error } = await supabase.rpc("partner_mark_delivered", { _order_id: id });
    if (error) return toast.error(error.message);
    toast.success("Delivered!");
    router.navigate({ to: "/delivery/dashboard" });
  };

  const stepIdx = data?.status === "delivered" ? 2 : data?.status === "out_for_delivery" ? 1 : 0;
  const addr = (data?.address ?? {}) as Record<string, any>;
  const addrLine = [addr.line1, addr.line2, addr.city, addr.pincode].filter(Boolean).join(", ");

  const DeliverTo = data ? (
    <Card className="rounded-xl border-border/70 p-4 shadow-none">
      <p className="eyebrow flex items-center gap-1.5">
        <MapPin className="h-3.5 w-3.5" /> Deliver to
      </p>
      <p className="mt-1.5 text-body font-semibold">{addr.full_name || "Customer"}</p>
      <p className="mt-0.5 text-small leading-snug text-muted-foreground">{addrLine}</p>
      {addr.phone && (
        <a
          href={`tel:${addr.phone}`}
          className="press mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-primary-soft px-4 text-small font-semibold text-primary-ink"
        >
          <Phone className="h-3.5 w-3.5" /> {addr.phone}
        </a>
      )}
      {data.delivery_instruction && (
        <p className="mt-3 rounded-xl bg-secondary px-3 py-2 text-small text-muted-foreground">
          Note: {data.delivery_instruction}
        </p>
      )}
    </Card>
  ) : null;

  return (
    <>
      <div className="space-y-4 px-4 pb-40 pt-3 md:px-6">
        <Link
          to="/delivery/dashboard"
          className="press inline-flex items-center gap-1 text-small font-medium text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        {isLoading && <div className="h-40 rounded-xl shimmer" />}
        {!isLoading && !data && (
          <p className="py-10 text-center text-body text-muted-foreground">Task not found.</p>
        )}

        {data && data.is_parent && (
          <>
            <MultiShopPickupPanel
              parentId={id}
              parent={{
                order_number: data.order_number,
                total: Number(data.total),
                shop_count: Number(data.shop_count ?? 0),
                delivery_type: data.delivery_type ?? null,
                fast_delivery_fee: data.fast_delivery_fee ?? null,
              }}
              onAllPickedUp={() => refetch()}
            />
            {DeliverTo}
            <div className="bar-blur hairline-t pb-safe fixed bottom-[calc(60px+env(safe-area-inset-bottom))] left-0 right-0 z-20 p-4">
              <div className="mx-auto max-w-md">
                {data.status === "out_for_delivery" ? (
                  <Button className="h-12 w-full rounded-xl" onClick={deliver}>
                    Mark as delivered
                  </Button>
                ) : (
                  <Button className="h-12 w-full rounded-xl" disabled variant="secondary">
                    Complete all pickups to proceed
                  </Button>
                )}
              </div>
            </div>
          </>
        )}

        {data && !data.is_parent && (
          <>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="large-title">{data.order_number}</h1>
                <DeliveryTypeBadge type={data.delivery_type} size="xs" />
              </div>
              <p className="mt-1 text-small text-muted-foreground">
                {rupees(Number(data.total))} · {data.payment_method?.toUpperCase()}
              </p>
            </div>

            <div className="flex items-center gap-2">
              {["Accepted", "Picked up", "Delivered"].map((label, i) => (
                <div key={label} className="flex-1">
                  <div
                    className={
                      "h-1.5 rounded-full " + (i <= stepIdx ? "bg-primary" : "bg-secondary")
                    }
                  />
                  <div
                    className={
                      "mt-1.5 text-caption font-medium " +
                      (i <= stepIdx ? "text-foreground" : "text-muted-foreground")
                    }
                  >
                    {label}
                  </div>
                </div>
              ))}
            </div>

            {data.shops &&
              Number.isFinite(data.shops.latitude) &&
              Number.isFinite(data.delivery_lat) && (
                <div className="overflow-hidden rounded-xl border border-border/70">
                  <RouteMap
                    points={[
                      {
                        lat: data.shops.latitude as number,
                        lng: data.shops.longitude as number,
                        label: "Shop",
                        color: "#16a34a",
                      },
                      {
                        lat: data.delivery_lat as number,
                        lng: data.delivery_lng as number,
                        label: "Drop",
                        color: "#dc2626",
                      },
                    ]}
                  />
                </div>
              )}

            {data.shops && (
              <Card className="rounded-xl border-border/70 p-4 shadow-none">
                <p className="eyebrow flex items-center gap-1.5">
                  <Store className="h-3.5 w-3.5" /> Pickup from shop
                </p>
                <p className="mt-1.5 text-body font-semibold">{data.shops.name}</p>
                <p className="mt-0.5 text-small leading-snug text-muted-foreground">
                  {data.shops.address}
                </p>
                {data.shops.phone && (
                  <a
                    href={`tel:${data.shops.phone}`}
                    className="press mt-2.5 inline-flex h-8 items-center gap-1.5 rounded-full bg-primary-soft px-4 text-small font-semibold text-primary-ink"
                  >
                    <Phone className="h-3.5 w-3.5" /> {data.shops.phone}
                  </a>
                )}
              </Card>
            )}

            {DeliverTo}

            <Card className="overflow-hidden rounded-xl border-border/70 shadow-none">
              <p className="eyebrow flex items-center gap-1.5 px-4 pb-1 pt-4">
                <Package className="h-3.5 w-3.5" /> Items ({data.order_items?.length || 0})
              </p>
              <ul className="divide-y divide-border/60 px-4 pb-1">
                {(data.order_items || []).map((it: any) => (
                  <li
                    key={it.id}
                    className="flex min-h-11 items-center justify-between gap-3 py-2 text-small"
                  >
                    <span className="min-w-0">
                      {it.name} <span className="text-muted-foreground">× {it.quantity}</span>
                    </span>
                    <span className="font-medium">{rupees(Number(it.price) * it.quantity)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="space-y-3 rounded-xl border-border/70 p-4 shadow-none">
              <h2 className="section-title">Live status</h2>
              <div className="flex flex-wrap gap-2">
                {[
                  { k: "going_to_shop", label: "Going to shop" },
                  { k: "picked_up", label: "Picked up" },
                  { k: "out_for_delivery", label: "Out for delivery" },
                  { k: "reached_area", label: "Reached area" },
                  { k: "delivered", label: "Delivered" },
                ].map((st) => (
                  <Button
                    key={st.k}
                    size="sm"
                    variant={st.k === "delivered" ? "default" : "secondary"}
                    className="h-8 rounded-full px-3.5"
                    disabled={sending}
                    onClick={async () => {
                      setSending(true);
                      const { error } = await supabase.rpc("partner_update_status" as any, {
                        _status: st.k,
                        _order_id: id,
                        _eta_minutes: Number(etaMin) > 0 ? Math.min(240, Number(etaMin)) : null,
                      });
                      setSending(false);
                      if (error) return toast.error(error.message);
                      toast.success(`Status: ${st.label}`);
                      if (st.k === "delivered") router.navigate({ to: "/delivery/dashboard" });
                      else refetch();
                    }}
                  >
                    {st.label}
                  </Button>
                ))}
              </div>
              <p className="text-small text-muted-foreground">
                Updates the shop, admin and customer for this order in real time.
              </p>
            </Card>

            <Card className="space-y-3 rounded-xl border-border/70 p-4 shadow-none">
              <h2 className="section-title">Notify customer</h2>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={240}
                  value={etaMin}
                  onChange={(e) => setEtaMin(e.target.value)}
                  className="w-20"
                />
                <span className="text-small text-muted-foreground">min</span>
                <Button
                  size="sm"
                  disabled={sending}
                  onClick={() => sendUpdate("eta", Math.max(1, Number(etaMin) || 0))}
                >
                  Send ETA
                </Button>
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={sending}
                  onClick={() => sendUpdate("delay", Math.max(1, Number(etaMin) || 0))}
                >
                  Delay
                </Button>
              </div>
              <Button
                variant="secondary"
                className="w-full"
                disabled={sending}
                onClick={() => sendUpdate("nearby")}
              >
                I've reached your area
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Custom message"
                  value={customMsg}
                  onChange={(e) => setCustomMsg(e.target.value)}
                  maxLength={240}
                />
                <Button
                  size="sm"
                  disabled={sending || !customMsg.trim()}
                  onClick={() => sendUpdate("custom", undefined, customMsg.trim())}
                >
                  Send
                </Button>
              </div>
              <p className="text-small text-muted-foreground">
                Only the customer for this order is notified.
              </p>
            </Card>

            {(data.status === "packed" || data.status === "out_for_delivery") && (
              <div className="bar-blur hairline-t pb-safe fixed bottom-[calc(60px+env(safe-area-inset-bottom))] left-0 right-0 z-20 p-4">
                <div className="mx-auto flex max-w-md gap-2">
                  {data.status === "packed" && (
                    <Button className="h-12 flex-1 rounded-xl" onClick={pickUp}>
                      Mark as picked up
                    </Button>
                  )}
                  {data.status === "out_for_delivery" && (
                    <Button className="h-12 flex-1 rounded-xl" onClick={deliver}>
                      Mark as delivered
                    </Button>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
