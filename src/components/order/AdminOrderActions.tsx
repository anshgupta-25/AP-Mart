import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Ban, Printer, RefreshCcw, Store, Truck, User, Undo2 } from "lucide-react";
import { rupees } from "@/lib/format";
import { optimisticPatch, patchOrderDetail } from "@/lib/optimistic";


type Props = { order: any };

export function AdminOrderActions({ order }: Props) {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);

  const shops = useQuery({
    queryKey: ["admin-shops-mini"],
    queryFn: async () => ((await supabase.rpc("admin_list_shops")).data as any[]) ?? [],
  });
  const partners = useQuery({
    queryKey: ["admin-partners-mini"],
    queryFn: async () => ((await supabase.from("delivery_partners").select("id, name, phone, is_online")).data as any[]) ?? [],
  });
  const payment = useQuery({
    queryKey: ["admin-order-payment", order.id],
    queryFn: async () =>
      (await supabase.from("payments").select("*").eq("order_id", order.id).order("created_at", { ascending: false }).limit(1).maybeSingle()).data as any,
  });

  const [shopId, setShopId] = useState("");
  const [partnerId, setPartnerId] = useState("");
  const [refundAmount, setRefundAmount] = useState(String(order.total ?? ""));
  const [refundRef, setRefundRef] = useState("");
  const [openShop, setOpenShop] = useState(false);
  const [openRider, setOpenRider] = useState(false);
  const [openRefund, setOpenRefund] = useState(false);

  const done = (msg: string) => {
    toast.success(msg);
    qc.invalidateQueries({ queryKey: ["order-details"] });
    qc.invalidateQueries({ queryKey: ["admin-orders-full"] });
    qc.invalidateQueries({ queryKey: ["admin-order-payment", order.id] });
  };

  const run = async (
    fn: () => Promise<{ error: any }>,
    msg: string,
    after?: () => void,
    patch?: Record<string, unknown>,
  ) => {
    setBusy(true);
    // Optimistic: patch the order detail cache right away, roll back on error.
    const rollback = patch
      ? optimisticPatch(qc, [["order-details", order.id], ["order-details"]], patchOrderDetail(patch))
      : () => {};
    const { error } = await fn();
    setBusy(false);
    if (error) {
      rollback();
      return toast.error(error.message);
    }
    done(msg);
    after?.();
  };


  const selectCls = "h-10 w-full rounded-xl border border-border bg-background px-2 text-sm";

  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <div className="font-bold text-sm">Admin actions</div>

      <div className="flex flex-wrap gap-2">
        <Button asChild size="sm" variant="outline" className="rounded-xl">
          <Link to="/admin/shops"><Store className="h-3.5 w-3.5 mr-1" />View shop</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="rounded-xl">
          <Link to="/admin/customers"><User className="h-3.5 w-3.5 mr-1" />View customer</Link>
        </Button>
        <Button asChild size="sm" variant="outline" className="rounded-xl">
          <Link to="/admin/delivery-partners"><Truck className="h-3.5 w-3.5 mr-1" />View rider</Link>
        </Button>
        <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.print()}>
          <Printer className="h-3.5 w-3.5 mr-1" />Print invoice
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 pt-1">
        {/* Reassign shop */}
        <Dialog open={openShop} onOpenChange={setOpenShop}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="rounded-xl"><RefreshCcw className="h-3.5 w-3.5 mr-1" />Reassign shop</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Reassign shop</DialogTitle></DialogHeader>
            <select className={selectCls} value={shopId} onChange={(e) => setShopId(e.target.value)}>
              <option value="">Select a shop…</option>
              {(shops.data ?? []).map((s: any) => (
                <option key={s.id} value={s.id}>{s.name} — {s.pincode} {s.owner_name ? `(${s.owner_name})` : "(no owner)"}</option>
              ))}
            </select>
            <DialogFooter>
              <Button
                disabled={!shopId || busy}
                onClick={() => run(() => supabase.rpc("admin_reassign_shop", { _order_id: order.id, _shop_id: shopId }) as any, "Shop reassigned", () => setOpenShop(false), { shop_id: shopId, status: "awaiting_shop" })}
              >
                Reassign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Reassign rider */}
        <Dialog open={openRider} onOpenChange={setOpenRider}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="rounded-xl"><Truck className="h-3.5 w-3.5 mr-1" />Reassign rider</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Reassign delivery partner</DialogTitle></DialogHeader>
            <select className={selectCls} value={partnerId} onChange={(e) => setPartnerId(e.target.value)}>
              <option value="">Select a rider…</option>
              {(partners.data ?? []).map((p: any) => (
                <option key={p.id} value={p.id}>{p.name} {p.phone ? `· ${p.phone}` : ""} {p.is_online ? "· online" : ""}</option>
              ))}
            </select>
            <DialogFooter>
              <Button
                disabled={!partnerId || busy}
                onClick={() => run(() => supabase.rpc("admin_reassign_partner", { _order_id: order.id, _partner_id: partnerId }) as any, "Rider reassigned", () => setOpenRider(false), { partner_id: partnerId })}
              >
                Reassign
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel */}
        <Button
          size="sm"
          variant="outline"
          className="rounded-xl text-destructive"
          disabled={busy || order.status === "cancelled" || order.status === "delivered"}
          onClick={() => {
            if (!confirm("Cancel this order? Stock will be restored where applicable.")) return;
            run(() => supabase.rpc("admin_update_order_status", { _order_id: order.id, _status: "cancelled" }) as any, "Order cancelled", undefined, { status: "cancelled" });
          }}
        >
          <Ban className="h-3.5 w-3.5 mr-1" />Cancel order
        </Button>

        {/* Refund */}
        <Dialog open={openRefund} onOpenChange={setOpenRefund}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" className="rounded-xl"><Undo2 className="h-3.5 w-3.5 mr-1" />Refund</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader><DialogTitle>Record refund</DialogTitle></DialogHeader>
            {payment.data ? (
              <div className="space-y-3 text-sm">
                <div className="text-muted-foreground">
                  Payment {payment.data.provider} · {String(payment.data.status).replace(/_/g, " ")} · {rupees(payment.data.amount)}
                </div>
                <Input value={refundAmount} onChange={(e) => setRefundAmount(e.target.value)} placeholder="Refund amount" className="rounded-xl" />
                <Input value={refundRef} onChange={(e) => setRefundRef(e.target.value)} placeholder="Refund reference ID" className="rounded-xl" />
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">No payment record found for this order.</div>
            )}
            <DialogFooter>
              <Button
                disabled={!payment.data || busy || !refundAmount}
                onClick={() =>
                  run(
                    () =>
                      supabase.rpc("admin_record_refund", {
                        _payment_id: payment.data.id,
                        _refund_id: refundRef || `manual-${Date.now()}`,
                        _amount: Number(refundAmount),
                      }) as any,
                    "Refund recorded",
                    () => setOpenRefund(false),
                  )
                }
              >
                Record refund
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
