import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/RoleShell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { RouteMap } from "@/components/maps/RouteMap";
import { rupees } from "@/lib/format";
import { toast } from "sonner";
import { ArrowLeft, MapPin, Package, Phone, Store, LayoutDashboard, PackageOpen, History, Wallet, User } from "lucide-react";
import { MultiShopPickupPanel } from "@/components/MultiShopPickupPanel";
import { DeliveryTypeBadge } from "@/components/FastDeliveryBadge";

const NAV = [
  { to: "/delivery/dashboard", label: "Home", icon: LayoutDashboard },
  { to: "/delivery/available-orders", label: "Available", icon: PackageOpen },
  { to: "/delivery/history", label: "History", icon: History },
  { to: "/delivery/earnings", label: "Earnings", icon: Wallet },
  { to: "/delivery/profile", label: "Profile", icon: User },
];

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

  const sendUpdate = async (kind: "eta" | "nearby" | "delay" | "custom", minutes?: number, message?: string) => {
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
        .select("*, order_items!order_items_order_id_fkey(*), shops(name,address,latitude,longitude,phone)")
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

  return (
    <RoleShell role="delivery" nav={NAV}>
      <div className="space-y-4 pb-24">
        <Link to="/delivery/dashboard" className="inline-flex items-center gap-1 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>

        {isLoading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {!isLoading && !data && <p className="text-sm text-muted-foreground">Task not found.</p>}

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
            <Card className="p-4">
              <p className="text-xs uppercase text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Deliver to</p>
              {(() => {
                const addr = (data.address ?? {}) as Record<string, any>;
                return (
                  <>
                    <p className="font-semibold mt-1">{addr.full_name || "Customer"}</p>
                    <p className="text-sm text-muted-foreground">
                      {[addr.line1, addr.line2, addr.city, addr.pincode].filter(Boolean).join(", ")}
                    </p>
                    {addr.phone && (
                      <a href={`tel:${addr.phone}`} className="mt-2 inline-flex items-center gap-1 text-sm text-primary">
                        <Phone className="h-3 w-3" /> {addr.phone}
                      </a>
                    )}
                  </>
                );
              })()}
              {data.delivery_instruction && (
                <p className="mt-2 text-xs italic text-muted-foreground">Note: {data.delivery_instruction}</p>
              )}
            </Card>
            <div className="fixed bottom-20 left-0 right-0 px-4">
              <div className="mx-auto max-w-md">
                {data.status === "out_for_delivery" ? (
                  <Button className="w-full" onClick={deliver}>Mark as delivered</Button>
                ) : (
                  <Button className="w-full" disabled variant="secondary">Complete all pickups to proceed</Button>
                )}
              </div>
            </div>
          </>
        )}

        {data && !data.is_parent && (
          <>

            <Card className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Order</p>
                  <p className="font-semibold flex items-center gap-2">{data.order_number} <DeliveryTypeBadge type={data.delivery_type} size="xs" /></p>
                </div>
                <Badge variant="secondary">{String(data.status).replace(/_/g, " ")}</Badge>
              </div>
              <p className="mt-2 text-sm">Total {rupees(Number(data.total))} · {data.payment_method?.toUpperCase()}</p>
            </Card>

            {data.shops && Number.isFinite(data.shops.latitude) && Number.isFinite(data.delivery_lat) && (
              <RouteMap
                points={[
                  { lat: data.shops.latitude as number, lng: data.shops.longitude as number, label: "Shop", color: "#16a34a" },
                  { lat: data.delivery_lat as number, lng: data.delivery_lng as number, label: "Drop", color: "#dc2626" },
                ]}
              />
            )}

            {data.shops && (
              <Card className="p-4">
                <p className="text-xs uppercase text-muted-foreground flex items-center gap-1"><Store className="h-3 w-3" /> Pickup from shop</p>
                <p className="font-semibold mt-1">{data.shops.name}</p>
                <p className="text-sm text-muted-foreground">{data.shops.address}</p>
                {data.shops.phone && (
                  <a href={`tel:${data.shops.phone}`} className="mt-2 inline-flex items-center gap-1 text-sm text-primary">
                    <Phone className="h-3 w-3" /> {data.shops.phone}
                  </a>
                )}
              </Card>
            )}

            <Card className="p-4">
              <p className="text-xs uppercase text-muted-foreground flex items-center gap-1"><MapPin className="h-3 w-3" /> Deliver to</p>
              {(() => {
                const addr = (data.address ?? {}) as Record<string, any>;
                return (
                  <>
                    <p className="font-semibold mt-1">{addr.full_name || "Customer"}</p>
                    <p className="text-sm text-muted-foreground">
                      {[addr.line1, addr.line2, addr.city, addr.pincode].filter(Boolean).join(", ")}
                    </p>
                    {addr.phone && (
                      <a href={`tel:${addr.phone}`} className="mt-2 inline-flex items-center gap-1 text-sm text-primary">
                        <Phone className="h-3 w-3" /> {addr.phone}
                      </a>
                    )}
                  </>
                );
              })()}
              {data.delivery_instruction && (
                <p className="mt-2 text-xs italic text-muted-foreground">Note: {data.delivery_instruction}</p>
              )}
            </Card>

            <Card className="p-4">
              <p className="text-xs uppercase text-muted-foreground flex items-center gap-1"><Package className="h-3 w-3" /> Items ({data.order_items?.length || 0})</p>
              <ul className="mt-2 divide-y">
                {(data.order_items || []).map((it: any) => (
                  <li key={it.id} className="flex justify-between py-2 text-sm">
                    <span>{it.name} <span className="text-muted-foreground">× {it.quantity}</span></span>
                    <span>{rupees(Number(it.price) * it.quantity)}</span>
                  </li>
                ))}
              </ul>
            </Card>

            <Card className="p-4 space-y-2">
              <p className="text-xs uppercase text-muted-foreground">Live status</p>
              <div className="flex flex-wrap gap-2">
                {[
                  { k: "going_to_shop", label: "Going to shop" },
                  { k: "picked_up", label: "Picked up" },
                  { k: "out_for_delivery", label: "Out for delivery" },
                  { k: "reached_area", label: "Reached area" },
                  { k: "delivered", label: "Delivered" },
                ].map((s) => (
                  <Button
                    key={s.k}
                    size="sm"
                    variant={s.k === "delivered" ? "default" : "secondary"}
                    disabled={sending}
                    onClick={async () => {
                      setSending(true);
                      const { error } = await supabase.rpc("partner_update_status" as any, {
                        _status: s.k,
                        _order_id: id,
                        _eta_minutes: Number(etaMin) > 0 ? Math.min(240, Number(etaMin)) : null,
                      });
                      setSending(false);
                      if (error) return toast.error(error.message);
                      toast.success(`Status: ${s.label}`);
                      if (s.k === "delivered") router.navigate({ to: "/delivery/dashboard" });
                      else refetch();
                    }}
                  >
                    {s.label}
                  </Button>
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground">Updates shopkeeper, admin, and the customer for this order in real time.</p>
            </Card>

            <Card className="p-4 space-y-3">

              <p className="text-xs uppercase text-muted-foreground">Notify customer</p>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  min={1}
                  max={240}
                  value={etaMin}
                  onChange={(e) => setEtaMin(e.target.value)}
                  className="w-24"
                />
                <span className="text-sm text-muted-foreground">min</span>
                <Button
                  size="sm"
                  disabled={sending}
                  onClick={() => sendUpdate("eta", Math.max(1, Number(etaMin) || 0))}
                >
                  Send ETA
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={sending}
                  onClick={() => sendUpdate("delay", Math.max(1, Number(etaMin) || 0))}
                >
                  Traffic delay
                </Button>
              </div>
              <Button
                size="sm"
                variant="secondary"
                disabled={sending}
                onClick={() => sendUpdate("nearby")}
              >
                I've reached your area
              </Button>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Custom message to customer"
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
              <p className="text-[11px] text-muted-foreground">Only the customer for this order receives this notification.</p>
            </Card>

            <div className="fixed bottom-20 left-0 right-0 px-4">
              <div className="mx-auto max-w-md flex gap-2">
                {data.status === "packed" && (
                  <Button className="flex-1" onClick={pickUp}>Mark as picked up</Button>
                )}
                {data.status === "out_for_delivery" && (
                  <Button className="flex-1" onClick={deliver}>Mark as delivered</Button>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </RoleShell>
  );
}
