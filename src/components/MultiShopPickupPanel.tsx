import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Store, Navigation2, CheckCircle2, Package, MapPin, Phone, Truck } from "lucide-react";
import { toast } from "sonner";
import { rupees } from "@/lib/format";

type Stop = {
  child_id: string;
  shop_id: string;
  shop_name: string;
  shop_address: string | null;
  shop_phone: string | null;
  shop_lat: number | null;
  shop_lng: number | null;
  status: string;
  pickup_verified_at: string | null;
  items_count: number;
  seq: number;
};

export function MultiShopPickupPanel({
  parentId,
  parent,
  onAllPickedUp,
}: {
  parentId: string;
  parent: { order_number: string; total: number; shop_count: number; delivery_type: string | null; fast_delivery_fee: number | null };
  onAllPickedUp: () => void;
}) {
  const qc = useQueryClient();

  const { data: stops, isLoading, refetch } = useQuery({
    queryKey: ["parent-stops", parentId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("partner_parent_pickup_stops", { _parent_id: parentId });
      if (error) throw error;
      return (data ?? []) as Stop[];
    },
    refetchInterval: 15000,
  });

  useEffect(() => {
    const ch = supabase
      .channel(`parent-${parentId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `parent_order_id=eq.${parentId}` }, () => {
        qc.invalidateQueries({ queryKey: ["parent-stops", parentId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [parentId, qc]);

  const totalItems = useMemo(() => (stops ?? []).reduce((n, s) => n + Number(s.items_count || 0), 0), [stops]);
  const done = (stops ?? []).filter((s) => s.pickup_verified_at).length;
  const nextIdx = (stops ?? []).findIndex((s) => !s.pickup_verified_at);
  const allDone = stops && stops.length > 0 && nextIdx === -1;

  useEffect(() => {
    if (allDone) onAllPickedUp();
  }, [allDone, onAllPickedUp]);

  if (isLoading) return <Card className="p-4 text-sm text-muted-foreground">Loading pickups…</Card>;

  return (
    <div className="space-y-3">
      <Card className="p-4 rounded-2xl border-2 border-primary/40 bg-primary/5">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <Badge className="bg-primary text-primary-foreground gap-1"><Truck className="h-3 w-3" /> Multi-Shop Delivery</Badge>
          <span className="text-xs text-muted-foreground">Order {parent.order_number}</span>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-3 text-center">
          <Stat label="Shops" value={String(parent.shop_count)} />
          <Stat label="Products" value={String(totalItems)} />
          <Stat label="Payout" value={rupees(parent.total)} />
        </div>
        <div className="mt-3 text-xs text-muted-foreground">
          Progress: <span className="font-bold text-foreground">{done}/{stops?.length ?? 0}</span> pickups completed
        </div>
      </Card>

      {(stops ?? []).map((s, i) => {
        const isNext = i === nextIdx;
        const done = !!s.pickup_verified_at;
        return (
          <Card
            key={s.child_id}
            className={
              "p-4 rounded-2xl " +
              (done
                ? "border-green-500/40 bg-green-50/60 dark:bg-green-950/20"
                : isNext
                  ? "border-2 border-primary shadow-sm"
                  : "opacity-70")
            }
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="rounded-full">Stop {s.seq}</Badge>
                <Store className="h-4 w-4 text-primary" />
                <span className="font-semibold">{s.shop_name}</span>
              </div>
              {done ? (
                <Badge className="bg-green-600 gap-1"><CheckCircle2 className="h-3 w-3" /> Picked up</Badge>
              ) : (
                <Badge variant="secondary">{String(s.status).replace(/_/g, " ")}</Badge>
              )}
            </div>
            <div className="mt-2 text-sm text-muted-foreground flex items-start gap-1">
              <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{s.shop_address ?? "—"}</span>
            </div>
            <div className="mt-1 text-xs text-muted-foreground flex items-center gap-1">
              <Package className="h-3 w-3" /> {s.items_count} item{s.items_count === 1 ? "" : "s"}
              {s.shop_phone && (
                <a href={`tel:${s.shop_phone}`} className="ml-3 inline-flex items-center gap-1 text-primary">
                  <Phone className="h-3 w-3" /> {s.shop_phone}
                </a>
              )}
            </div>

            {!done && (
              <div className="mt-3 flex flex-wrap gap-2">
                {s.shop_lat && s.shop_lng && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const url = `https://www.google.com/maps/dir/?api=1&destination=${s.shop_lat},${s.shop_lng}&travelmode=driving`;
                      window.open(url, "_blank", "noopener,noreferrer");
                    }}
                  >
                    <Navigation2 className="h-3.5 w-3.5 mr-1" /> Navigate
                  </Button>
                )}
                <PickupOtpDialog childId={s.child_id} shopName={s.shop_name} onDone={refetch} disabled={!isNext} />
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase text-muted-foreground tracking-wide">{label}</div>
      <div className="font-display font-extrabold text-lg">{value}</div>
    </div>
  );
}

function PickupOtpDialog({ childId, shopName, onDone, disabled }: { childId: string; shopName: string; onDone: () => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [otp, setOtp] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (otp.trim().length < 4) return toast.error("Enter the OTP from the shopkeeper");
    setBusy(true);
    const { error } = await supabase.rpc("rider_verify_pickup", { _child_id: childId, _otp: otp.trim() });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`Picked up from ${shopName}`);
    setOtp("");
    setOpen(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" disabled={disabled} className="rounded-xl">
          <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> Pickup complete
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify pickup — {shopName}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Ask the shopkeeper for the 4-digit OTP shown on their order screen.</p>
        <Input value={otp} onChange={(e) => setOtp(e.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="OTP" inputMode="numeric" />
        <Button onClick={submit} disabled={busy} className="w-full">Confirm pickup</Button>
      </DialogContent>
    </Dialog>
  );
}
