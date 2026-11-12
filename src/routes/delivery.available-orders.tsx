import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/RoleShell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { rupees } from "@/lib/format";
import { toast } from "sonner";
import { Truck, Store, Package } from "lucide-react";
import { DELIVERY_NAV } from "./delivery.dashboard";
import { FastDeliveryBadge } from "@/components/FastDeliveryBadge";
import { runOptimistic, removeRow } from "@/lib/optimistic";


export const Route = createFileRoute("/delivery/available-orders")({
  head: () => ({ meta: [{ title: "Available Orders — Delivery" }] }),
  component: Page,
});

type Parent = {
  parent_id: string; order_number: string; total: number; shop_count: number;
  items_count: number; city: string | null; pincode: string | null; ready_at: string;
  delivery_type: string | null; fast_delivery_fee: number | null;
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
    return () => { supabase.removeChannel(ch); };
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
        id: string; order_number: string; total: number; city: string | null;
        area_pincode: string | null; item_count: number; shop_name: string | null;
        delivery_type?: string | null; fast_delivery_fee?: number | null; placed_at?: string;
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
    <RoleShell role="delivery" nav={DELIVERY_NAV} requireRoles={["delivery", "admin"]}>
      <div className="p-4 md:p-6 space-y-6">
        <div>
          <h1 className="font-display text-3xl font-extrabold flex items-center gap-2"><Truck className="h-7 w-7 text-primary" />My assignments</h1>
          <p className="text-sm text-muted-foreground mt-1">Multi-shop and single-shop orders ready for pickup.</p>
        </div>

        <section>
          <h2 className="font-bold mb-3 flex items-center gap-2">
            <Store className="h-4 w-4 text-primary" /> Multi-Shop Deliveries
            {(parents.data?.length ?? 0) > 0 && (
              <Badge className="bg-primary text-primary-foreground">{parents.data!.length}</Badge>
            )}
          </h2>
          <div className="space-y-3">
            {(parents.data ?? []).map((p) => {
              const isFast = p.delivery_type === "fast_delivery";
              return (
                <div
                  key={p.parent_id}
                  className={
                    (isFast ? "border-2 border-red-500 bg-red-50 dark:bg-red-950/30 " : "border border-primary/30 bg-primary/5 ") +
                    "rounded-2xl p-4 flex items-center justify-between gap-3 flex-wrap shadow-sm"
                  }
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-primary text-primary-foreground gap-1"><Truck className="h-3 w-3" /> Multi-Shop</Badge>
                      <div className="font-bold">{p.order_number} • {rupees(p.total)}</div>
                      {isFast && <FastDeliveryBadge />}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center gap-1"><Store className="h-3 w-3" /> {p.shop_count} shops</span>
                      <span className="inline-flex items-center gap-1"><Package className="h-3 w-3" /> {p.items_count} items</span>
                      {[p.city, p.pincode].filter(Boolean).length > 0 && <span>· {[p.city, p.pincode].filter(Boolean).join(" • ")}</span>}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => acceptParent(p.parent_id)} className="rounded-xl gradient-primary text-primary-foreground">
                    Accept all shops
                  </Button>
                </div>
              );
            })}
            {(parents.data?.length ?? 0) === 0 && (
              <div className="text-sm text-muted-foreground">No multi-shop orders waiting.</div>
            )}
          </div>
        </section>

        <section>
          <h2 className="font-bold mb-3">Single-shop assignments</h2>
          <div className="space-y-3">
            {(orders.data ?? []).map(o => {
              const isFast = o.delivery_type === "fast_delivery";
              return (
                <div
                  key={o.id}
                  className={
                    isFast
                      ? "rounded-2xl border-2 border-red-500 bg-red-50 dark:bg-red-950/30 p-4 flex items-center justify-between gap-3 flex-wrap shadow-md"
                      : "rounded-2xl border border-border bg-card p-4 flex items-center justify-between gap-3 flex-wrap"
                  }
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="font-bold">{o.order_number} • {rupees(o.total)}</div>
                      {isFast && <FastDeliveryBadge />}
                    </div>
                    <div className="text-xs text-muted-foreground">{[o.shop_name, o.city, o.area_pincode].filter(Boolean).join(" • ")} · {o.item_count} item{o.item_count === 1 ? "" : "s"}</div>
                    {isFast && (
                      <div className="text-xs text-red-700 dark:text-red-300 font-semibold mt-0.5">
                        ⏱ Deliver within 15–30 min{o.fast_delivery_fee ? ` · Extra ${rupees(o.fast_delivery_fee)}` : ""}
                      </div>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => accept(o.id)}
                    className={isFast
                      ? "rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold"
                      : "rounded-xl gradient-primary text-primary-foreground"}
                  >
                    {isFast ? "Accept now" : "Accept"}
                  </Button>
                </div>
              );
            })}
            {(orders.data?.length ?? 0) === 0 && <div className="text-sm text-muted-foreground">No single-shop assignments right now.</div>}
          </div>
        </section>
      </div>
    </RoleShell>
  );
}

