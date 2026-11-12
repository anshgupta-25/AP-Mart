import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Package, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { rupees } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { AuthRequired } from "@/components/AuthRequired";

export const Route = createFileRoute("/orders/")({
  head: () => ({ meta: [{ title: "My orders — AP Mart" }] }),
  component: OrdersPage,
});

const statusColor: Record<string, string> = {
  placed: "bg-warning/20 text-warning-foreground",
  confirmed: "bg-warning/20 text-warning-foreground",
  packed: "bg-accent text-accent-foreground",
  out_for_delivery: "bg-primary/20 text-primary",
  delivered: "bg-success/30 text-success-foreground",
  cancelled: "bg-destructive/20 text-destructive",
};

function OrdersPage() {
  const { user } = useAuth();
  const orders = useQuery({
    queryKey: ["orders", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Only the columns this list renders, newest 50 (payload trim).
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, status, total, payment_method, placed_at")
        .order("placed_at", { ascending: false })
        .limit(50);

      return data ?? [];
    },
    enabled: !!user,
  });

  if (!user) {
    return (
      <AuthRequired
        next="/orders"
        title="Track Your Orders"
        description="Sign in to see your order history, live tracking and past invoices."
        icon={<Package className="h-12 w-12 text-primary" strokeWidth={1.75} />}
      />
    );
  }


  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="font-display text-3xl font-extrabold mb-4">My orders</h1>
      {orders.isLoading ? (
        <div className="space-y-3">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-2xl" />)}</div>
      ) : orders.data?.length === 0 ? (
        <div className="text-center py-20">
          <Package className="h-16 w-16 mx-auto text-muted-foreground" />
          <p className="mt-3 text-muted-foreground">No orders yet.</p>
          <Link to="/products" className="mt-4 inline-block text-primary font-bold">Start shopping →</Link>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.data?.map((o) => (
            <Link
              key={o.id}
              to="/orders/$id"
              params={{ id: o.id }}
              className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4 shadow-card hover:shadow-glow transition"
            >
              <div>
                <div className="text-xs text-muted-foreground">{o.order_number}</div>
                <div className="font-bold">{rupees(o.total)} • {o.payment_method.toUpperCase()}</div>
                <div className="text-xs text-muted-foreground mt-1">{new Date(o.placed_at).toLocaleString()}</div>
              </div>
              <div className="flex items-center gap-3">
                <span className={`text-[10px] font-bold uppercase rounded-full px-2 py-1 ${statusColor[o.status] ?? "bg-secondary"}`}>
                  {o.status.replace(/_/g, " ")}
                </span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
