import { createFileRoute } from "@tanstack/react-router";
import { Check, MessageCircle, PackageCheck, Phone, Printer, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/RoleShell";
import { rupees } from "@/lib/format";
import { SHOPKEEPER_NAV } from "./shopkeeper.dashboard";
import { OrderAuditLog } from "@/components/OrderAuditLog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DeliveryTypeBadge } from "@/components/FastDeliveryBadge";
import { useOrderDetails } from "@/components/order/useOrderDetails";
import { CustomerInfoCard, OrderItemsPanel, OrderMetaStrip, OrderSummaryCard, OrderTimeline } from "@/components/order/OrderPanels";
import { useQueryClient } from "@tanstack/react-query";
import { runOptimistic, patchOrderDetail } from "@/lib/optimistic";


export const Route = createFileRoute("/shopkeeper/orders/$id")({
  head: () => ({ meta: [{ title: "Order — Shopkeeper" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const q = useOrderDetails(id, { scopeToShop: true, refetchInterval: 15000 });


  if (!q.data)
    return (
      <RoleShell role="shopkeeper" nav={SHOPKEEPER_NAV} requireRoles={["shopkeeper", "admin"]}>
        <div className="p-6">{q.isLoading ? "Loading…" : "Order not found."}</div>
      </RoleShell>
    );

  const { order: o, items, totalQuantity, productCount } = q.data as any;
  const isChild = !!o.parent_order_id;
  const phone = (o.address as any)?.phone as string | undefined;

  const accept = async () => {
    await runOptimistic({
      qc,
      keys: [["order-details", id], ["shop-orders"]],
      updater: patchOrderDetail({ status: "accepted_by_shop" }),
      request: () =>
        (supabase.rpc as any)(isChild ? "shop_accept_child" : "shop_accept_order",
          isChild ? { _child_id: o.id, _prep_minutes: 15 } : { _order_id: o.id }),
      success: "Order accepted",
    });
  };
  const reject = async () => {
    const reason = window.prompt("Reason for rejecting this order? (optional)") ?? null;
    await runOptimistic({
      qc,
      keys: [["order-details", id], ["shop-orders"]],
      updater: patchOrderDetail({ status: "awaiting_shop" }),
      request: () =>
        (supabase.rpc as any)(isChild ? "shop_reject_child" : "shop_reject_order",
          isChild ? { _child_id: o.id, _reason: reason } : { _order_id: o.id, _reason: reason }),
      success: "Order rejected — searching replacement shop",
    });
  };
  const pack = async () => {
    await runOptimistic({
      qc,
      keys: [["order-details", id], ["shop-orders"]],
      updater: patchOrderDetail({ status: isChild ? "packed" : "packed" }),
      request: () =>
        (supabase.rpc as any)(isChild ? "shop_mark_child_ready" : "shop_mark_packed",
          isChild ? { _child_id: o.id } : { _order_id: o.id }),
      success: "Marked ready",
    });
  };


  return (
    <RoleShell role="shopkeeper" nav={SHOPKEEPER_NAV} requireRoles={["shopkeeper", "admin"]}>
      <div className="p-4 md:p-6 max-w-5xl space-y-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div>
            <h1 className="font-display text-2xl font-bold flex items-center gap-2 flex-wrap">
              {o.order_number}
              <DeliveryTypeBadge type={o.delivery_type} size="sm" />
            </h1>
            <div className="text-sm text-muted-foreground mt-1">{o.status.replace(/_/g, " ")} • {rupees(o.total)}</div>
            {isChild && <div className="text-xs text-primary font-semibold mt-1">Part of a multi-shop order — showing only your items</div>}
          </div>
          <div className="flex gap-2 flex-wrap">
            {o.status === "awaiting_shop" && (
              <>
                <Button size="sm" onClick={accept} className="rounded-xl"><Check className="h-3 w-3 mr-1" />Accept</Button>
                <Button size="sm" variant="outline" onClick={reject} className="rounded-xl"><X className="h-3 w-3 mr-1" />Reject</Button>
              </>
            )}
            {o.status === "accepted_by_shop" && (
              <Button size="sm" onClick={pack} className="rounded-xl"><PackageCheck className="h-3 w-3 mr-1" />Mark ready</Button>
            )}
            {phone && (
              <>
                <Button asChild size="sm" variant="outline" className="rounded-xl">
                  <a href={`tel:${phone}`}><Phone className="h-3 w-3 mr-1" />Call</a>
                </Button>
                <Button asChild size="sm" variant="outline" className="rounded-xl">
                  <a href={`sms:${phone}`}><MessageCircle className="h-3 w-3 mr-1" />Chat</a>
                </Button>
              </>
            )}
            <Button size="sm" variant="outline" className="rounded-xl" onClick={() => window.print()}>
              <Printer className="h-3 w-3 mr-1" />Print
            </Button>
          </div>
        </div>

        <OrderMetaStrip order={o} />

        {o.pickup_otp && o.status !== "awaiting_shop" && o.status !== "cancelled" && (
          <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4">
            <div className="text-xs uppercase font-bold text-muted-foreground">Pickup OTP</div>
            <div className="mt-1 font-mono text-3xl font-black tracking-widest text-primary">{o.pickup_otp}</div>
            <div className="text-xs text-muted-foreground mt-1">Share this code with the delivery partner at handover.</div>
          </div>
        )}

        <div className="grid lg:grid-cols-3 gap-4">
          <div className="lg:col-span-2 space-y-4">
            <div>
              <h2 className="font-bold mb-2 text-sm">Items & inventory impact</h2>
              <OrderItemsPanel items={items} />
            </div>
            <OrderAuditLog orderId={o.id} />
          </div>
          <div className="space-y-4">
            <OrderSummaryCard order={o} productCount={productCount} totalQuantity={totalQuantity} />
            <CustomerInfoCard order={o} />
            <OrderTimeline status={o.status} />
          </div>
        </div>
      </div>
    </RoleShell>
  );
}
