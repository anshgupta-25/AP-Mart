import { createFileRoute } from "@tanstack/react-router";
import { Check, MessageCircle, PackageCheck, Phone, Printer, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { rupees } from "@/lib/format";
import { OrderAuditLog } from "@/components/OrderAuditLog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { DeliveryTypeBadge } from "@/components/FastDeliveryBadge";
import { useOrderDetails } from "@/components/order/useOrderDetails";
import {
  CustomerInfoCard,
  OrderItemsPanel,
  OrderMetaStrip,
  OrderSummaryCard,
  OrderTimeline,
} from "@/components/order/OrderPanels";
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
      <div className="mx-auto max-w-6xl px-4 py-4 text-body text-muted-foreground md:px-6">
        {q.isLoading ? <div className="h-40 rounded-xl shimmer" /> : "Order not found."}
      </div>
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
        (supabase.rpc as any)(
          isChild ? "shop_accept_child" : "shop_accept_order",
          isChild ? { _child_id: o.id, _prep_minutes: 15 } : { _order_id: o.id },
        ),
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
        (supabase.rpc as any)(
          isChild ? "shop_reject_child" : "shop_reject_order",
          isChild ? { _child_id: o.id, _reason: reason } : { _order_id: o.id, _reason: reason },
        ),
      success: "Order rejected — searching replacement shop",
    });
  };
  const pack = async () => {
    await runOptimistic({
      qc,
      keys: [["order-details", id], ["shop-orders"]],
      updater: patchOrderDetail({ status: isChild ? "packed" : "packed" }),
      request: () =>
        (supabase.rpc as any)(
          isChild ? "shop_mark_child_ready" : "shop_mark_packed",
          isChild ? { _child_id: o.id } : { _order_id: o.id },
        ),
      success: "Marked ready",
    });
  };

  return (
    <>
      <div className="mx-auto max-w-5xl space-y-5 px-4 py-4 md:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="large-title flex flex-wrap items-center gap-2">
              {o.order_number}
              <DeliveryTypeBadge type={o.delivery_type} size="sm" />
            </h1>
            <div className="mt-1 text-body capitalize text-muted-foreground">
              {o.status.replace(/_/g, " ")} · {rupees(o.total)}
            </div>
            {isChild && (
              <div className="mt-1.5 text-meta font-medium text-primary-ink">
                Part of a multi-shop order — showing only your items
              </div>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {o.status === "awaiting_shop" && (
              <>
                <Button onClick={accept}>
                  <Check className="mr-1 h-4 w-4" />
                  Accept
                </Button>
                <Button variant="secondary" onClick={reject}>
                  <X className="mr-1 h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
            {o.status === "accepted_by_shop" && (
              <Button onClick={pack}>
                <PackageCheck className="mr-1 h-4 w-4" />
                Mark ready
              </Button>
            )}
            {phone && (
              <>
                <Button asChild variant="secondary">
                  <a href={`tel:${phone}`}>
                    <Phone className="mr-1 h-4 w-4" />
                    Call
                  </a>
                </Button>
                <Button asChild variant="secondary">
                  <a href={`sms:${phone}`}>
                    <MessageCircle className="mr-1 h-4 w-4" />
                    Chat
                  </a>
                </Button>
              </>
            )}
            <Button variant="secondary" onClick={() => window.print()}>
              <Printer className="mr-1 h-4 w-4" />
              Print
            </Button>
          </div>
        </div>

        <OrderMetaStrip order={o} />

        {o.pickup_otp && o.status !== "awaiting_shop" && o.status !== "cancelled" && (
          <div className="rounded-xl bg-tint-mint p-4">
            <div className="eyebrow">Pickup code</div>
            <div className="mt-1 font-mono text-page font-semibold tracking-widest text-primary-ink">
              {o.pickup_otp}
            </div>
            <div className="mt-1 text-meta text-foreground/65">
              Share this code with the delivery partner at handover.
            </div>
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">
          <div className="space-y-5 lg:col-span-2">
            <div>
              <h2 className="section-title mb-3">Items</h2>
              <OrderItemsPanel items={items} />
            </div>
            <OrderAuditLog orderId={o.id} />
          </div>
          <div className="space-y-5">
            <OrderSummaryCard order={o} productCount={productCount} totalQuantity={totalQuantity} />
            <CustomerInfoCard order={o} />
            <OrderTimeline status={o.status} />
          </div>
        </div>
      </div>
    </>
  );
}
