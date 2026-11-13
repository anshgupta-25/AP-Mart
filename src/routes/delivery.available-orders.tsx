import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { rupees } from "@/lib/format";
import { toast } from "sonner";
import { Truck, Store, Package } from "lucide-react";
import { FastDeliveryBadge } from "@/components/FastDeliveryBadge";
import { runOptimistic, removeRow } from "@/lib/optimistic";
import { PageHeader } from "@/components/data";

export const Route = createFileRoute("/delivery/available-orders")({
  head: () => ({ meta: [{ title: "Available Orders — Delivery" }] }),
  component: Page,
});

type Parent = {
  parent_id: string;
  order_number: string;
  total: number;
  shop_count: number;
  items_count: number;
  city: string | null;
  pincode: string | null;
  ready_at: string;
  delivery_type: string | null;
  fast_delivery_fee: number | null;
};

function Page() {
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    const ch = supabase
      .channel("available-orders")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["available-orders"] });
        qc.invalidateQueries({ queryKey: ["available-parent-orders"] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(ch);
    };
  }, [qc]);

  const parents = useQuery({
    queryKey: ["available-parent-orders"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("partner_available_parent_orders");
      if (error) throw error;
      return (data ?? []) as Parent[];
    },
    refetchInterval: 30000,
  });

  const orders = useQuery({
    queryKey: ["available-orders"],
    queryFn: async () => {
      const { data } = await supabase.rpc("partner_available_orders");
      return (data ?? []) as Array<{
        id: string;
        order_number: string;
        total: number;
        city: string | null;
        area_pincode: string | null;
        item_count: number;
        shop_name: string | null;
        delivery_type?: string | null;
        fast_delivery_fee?: number | null;
        placed_at?: string;
      }>;
    },
    refetchInterval: 30000,
  });

  const acceptParent = async (parent_id: string) => {
    await runOptimistic({
      qc,
      keys: [["available-parent-orders"]],
      updater: removeRow(parent_id, ["parent_id", "id"]),
      request: () => supabase.rpc("partner_accept_parent", { _parent_id: parent_id }),
      success: "Accepted multi-shop order",
      onSuccess: () => navigate({ to: "/delivery/task/$id", params: { id: parent_id } }),
    });
  };

  const accept = async (id: string) => {
    await runOptimistic({
      qc,
      keys: [["available-orders"]],
      updater: removeRow(id),
      request: () => supabase.rpc("partner_accept_order", { _order_id: id }),
      success: "Accepted! Start delivery.",
    });
  };

  return (
    <>
      <div className="space-y-5 px-4 py-4 md:px-6">
        <PageHeader
          title="Available orders"
          subtitle="Orders from nearby shops, ready for pickup."
        />

        <section className="space-y-2.5">
          <div className="flex items-center gap-2">
            <h2 className="section-title">Multi-shop deliveries</h2>
            {(parents.data?.length ?? 0) > 0 && <Badge>{parents.data!.length}</Badge>}
          </div>
          {(parents.data ?? []).map((p) => {
            const isFast = p.delivery_type === "fast_delivery";
            return (
              <div
                key={p.parent_id}
                className={
                  "space-y-3 rounded-xl border bg-card p-3.5 " +
                  (isFast ? "border-destructive/30" : "border-border/70")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-body font-semibold">{p.order_number}</div>
                      {isFast && <FastDeliveryBadge />}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-small text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Store className="h-3 w-3" /> {p.shop_count} shops
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Package className="h-3 w-3" /> {p.items_count} items
                      </span>
                      {[p.city, p.pincode].filter(Boolean).length > 0 && (
                        <span>{[p.city, p.pincode].filter(Boolean).join(" · ")}</span>
                      )}
                    </div>
                  </div>
                  <div className="text-body font-semibold">{rupees(p.total)}</div>
                </div>
                <Button
                  onClick={() => acceptParent(p.parent_id)}
                  className="h-11 w-full rounded-xl"
                >
                  <Truck className="h-4 w-4" /> Accept all shops
                </Button>
              </div>
            );
          })}
          {(parents.data?.length ?? 0) === 0 && (
            <div className="rounded-xl border border-border/70 bg-card p-4 text-center text-small text-muted-foreground">
              No multi-shop orders waiting.
            </div>
          )}
        </section>

        <section className="space-y-2.5">
          <h2 className="section-title">Single-shop orders</h2>
          {(orders.data ?? []).map((o) => {
            const isFast = o.delivery_type === "fast_delivery";
            return (
              <div
                key={o.id}
                className={
                  "space-y-3 rounded-xl border bg-card p-3.5 " +
                  (isFast ? "border-destructive/30" : "border-border/70")
                }
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <div className="text-body font-semibold">{o.order_number}</div>
                      {isFast && <FastDeliveryBadge />}
                    </div>
                    <div className="mt-1 text-small leading-snug text-muted-foreground">
                      {[o.shop_name, o.city, o.area_pincode].filter(Boolean).join(" · ")} ·{" "}
                      {o.item_count} item{o.item_count === 1 ? "" : "s"}
                    </div>
                    {isFast && (
                      <div className="mt-1 text-caption font-semibold text-destructive">
                        Priority delivery
                        {o.fast_delivery_fee ? ` · +${rupees(o.fast_delivery_fee)}` : ""}
                      </div>
                    )}
                  </div>
                  <div className="text-body font-semibold">{rupees(o.total)}</div>
                </div>
                <Button
                  onClick={() => accept(o.id)}
                  className={
                    "h-11 w-full rounded-xl " +
                    (isFast
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : "")
                  }
                >
                  {isFast ? "Accept now" : "Accept"}
                </Button>
              </div>
            );
          })}
          {(orders.data?.length ?? 0) === 0 && (
            <div className="rounded-xl border border-border/70 bg-card p-4 text-center text-small text-muted-foreground">
              No single-shop orders right now.
            </div>
          )}
        </section>
      </div>
    </>
  );
}
