import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { rupees } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { StorageImg } from "@/components/StorageImg";

export const Route = createFileRoute("/customer/orders/")({
  head: () => ({ meta: [{ title: "Orders — AP Mart" }] }),
  component: AppOrders,
});

const statusColor: Record<string, string> = {
  placed: "bg-warning/20 text-warning-foreground",
  confirmed: "bg-warning/20 text-warning-foreground",
  packed: "bg-accent text-accent-foreground",
  out_for_delivery: "bg-primary/20 text-primary",
  delivered: "bg-success/30 text-success-foreground",
  cancelled: "bg-destructive/20 text-destructive",
  awaiting_shop: "bg-yellow-100 text-yellow-800",
  accepted_by_shop: "bg-blue-100 text-blue-800",
  payment_confirmed: "bg-purple-100 text-purple-800",
  no_shop_available: "bg-red-100 text-red-800",
};

function AppOrders() {
  const { user } = useAuth();
  const orders = useQuery({
    queryKey: ["app-orders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("orders")
        .select("*, items:order_items!order_items_order_id_fkey(id,name,image_url,quantity), shop:shops(name)")
        .eq("user_id", user.id)
        .order("placed_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!user,
    refetchInterval: 20000,
  });


  return (
    <div className="px-4 py-4">
      <h1 className="font-display text-2xl font-extrabold mb-4">My orders</h1>
      {orders.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}
        </div>
      ) : orders.data?.length === 0 ? (
        <div className="text-center py-16">
          <Package className="h-14 w-14 mx-auto text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">No orders yet.</p>
          <Link
            to="/customer/categories"
            className="mt-4 inline-block rounded-2xl gradient-primary px-5 py-2.5 font-bold text-primary-foreground shadow-glow text-sm"
          >
            Start shopping →
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.data?.map((o: any) => {
            const items = (o.items ?? []) as Array<{ id: string; name: string; image_url: string | null; quantity: number }>;
            const preview = items.slice(0, 3);
            const extra = Math.max(0, items.length - preview.length);
            const firstName = items[0]?.name;
            const totalQty = items.reduce((s, it) => s + (it.quantity ?? 0), 0);
            return (
              <Link
                key={o.id}
                to="/customer/orders/$id"
                params={{ id: o.id }}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card hover:shadow-glow transition"
              >
                <div className="flex -space-x-3 shrink-0">
                  {preview.length === 0 ? (
                    <div className="h-14 w-14 rounded-xl bg-secondary grid place-items-center ring-2 ring-card">🛒</div>
                  ) : (
                    preview.map((it) =>
                      it.image_url ? (
                        <StorageImg loading="lazy" decoding="async" key={it.id} src={it.image_url} alt={it.name} className="h-14 w-14 rounded-xl object-cover ring-2 ring-card bg-secondary" />
                      ) : (
                        <div key={it.id} className="h-14 w-14 rounded-xl bg-secondary grid place-items-center ring-2 ring-card text-lg">🛒</div>
                      )
                    )
                  )}
                  {extra > 0 && (
                    <div className="h-14 w-14 rounded-xl bg-foreground/85 text-background grid place-items-center ring-2 ring-card text-xs font-bold">
                      +{extra}
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] text-muted-foreground truncate">{o.order_number}{o.shop?.name ? ` • ${o.shop.name}` : ""}</div>
                  <div className="font-bold text-sm truncate">
                    {firstName ? firstName : `${rupees(o.total)} • ${o.payment_method.toUpperCase()}`}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                    {rupees(o.total)} • {o.payment_method.toUpperCase()} • {o.payment_status} • {totalQty} item{totalQty === 1 ? "" : "s"}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {(o.delivery_type ?? "standard_delivery").replace(/_/g, " ")} • {new Date(o.placed_at).toLocaleString()}
                  </div>
                  {o.status === "cancelled" && o.cancel_reason && (
                    <div className="text-[11px] text-destructive mt-0.5 truncate">Cancelled: {o.cancel_reason}</div>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-1 ${statusColor[o.status] ?? "bg-secondary"}`}>
                    {o.status.replace(/_/g, " ")}
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </Link>
            );
          })}

        </div>
      )}
    </div>
  );
}
