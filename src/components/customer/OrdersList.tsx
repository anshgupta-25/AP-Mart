import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { rupees } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { StorageImg } from "@/components/StorageImg";
import { AuthRequired } from "@/components/AuthRequired";

const statusColor: Record<string, string> = {
  placed: "bg-tint-sun text-warning-foreground",
  confirmed: "bg-tint-sun text-warning-foreground",
  packed: "bg-tint-peach text-warning-foreground",
  out_for_delivery: "bg-tint-sky text-foreground",
  delivered: "bg-primary-soft text-primary-ink",
  cancelled: "bg-destructive/10 text-destructive",
  awaiting_shop: "bg-tint-sun text-warning-foreground",
  accepted_by_shop: "bg-tint-sky text-foreground",
  payment_confirmed: "bg-tint-violet text-foreground",
  no_shop_available: "bg-destructive/10 text-destructive",
};

/**
 * Single orders list for both /orders and /customer/orders: guest sign-in gate, item thumbnails,
 * shop name, cancel reason, all statuses, and a 20 s refetch. `detail` picks the detail-route family.
 */
// Same terminal set the database uses (see delete-shop guard migration).
const FINISHED_STATUSES = new Set(["delivered", "cancelled", "no_shop_available"]);

export function OrdersList({ detail, next }: { detail: "public" | "customer"; next: string }) {
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
    // Keep the full history (as /customer/orders did on main), but only poll every
    // 20 s while an order is still in progress; finished history doesn't change.
    refetchInterval: (query) =>
      ((query.state.data ?? []) as Array<{ status: string }>).some((o) => !FINISHED_STATUSES.has(o.status))
        ? 20000
        : false,
  });

  if (!user) {
    return (
      <AuthRequired
        next={next}
        title="Track Your Orders"
        description="Sign in to see your order history, live tracking and past invoices."
        icon={<Package className="h-6 w-6 text-primary" strokeWidth={1.8} />}
      />
    );
  }

  const Row = ({ o }: { o: any }) => {
    const items = (o.items ?? []) as Array<{ id: string; name: string; image_url: string | null; quantity: number }>;
    const preview = items.slice(0, 3);
    const extra = Math.max(0, items.length - preview.length);
    const totalQty = items.reduce((s, it) => s + (it.quantity ?? 0), 0);
    const content = (
      <>
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 truncate text-caption text-muted-foreground">
            {o.order_number}
            {o.shop?.name ? ` · ${o.shop.name}` : ""}
          </div>
          <span className={`shrink-0 rounded-full px-2 py-0.5 text-micro font-semibold capitalize ${statusColor[o.status] ?? "bg-secondary"}`}>{o.status.replace(/_/g, " ")}</span>
        </div>
        <div className="mt-2.5 flex items-center gap-3">
          <div className="flex shrink-0 -space-x-2.5">
            {preview.length === 0 ? (
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-muted-foreground ring-2 ring-card">
                <Package className="h-5 w-5" strokeWidth={1.6} />
              </div>
            ) : (
              preview.map((it) =>
                it.image_url ? (
                  <StorageImg key={it.id} loading="lazy" decoding="async" src={it.image_url} alt={it.name} className="h-11 w-11 rounded-lg bg-secondary object-cover ring-2 ring-card" />
                ) : (
                  <div key={it.id} className="grid h-11 w-11 place-items-center rounded-lg bg-secondary text-muted-foreground ring-2 ring-card">
                    <Package className="h-5 w-5" strokeWidth={1.6} />
                  </div>
                ),
              )
            )}
            {extra > 0 && <div className="grid h-11 w-11 place-items-center rounded-lg bg-foreground/85 text-xs font-semibold text-background ring-2 ring-card">+{extra}</div>}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-meta font-semibold">{items[0]?.name ?? `${rupees(o.total)} · ${String(o.payment_method ?? "").toUpperCase()}`}</div>
            <div className="mt-0.5 truncate text-caption text-muted-foreground">
              {totalQty} item{totalQty === 1 ? "" : "s"} · {rupees(o.total)}
            </div>
            <div className="mt-0.5 truncate text-caption text-muted-foreground">{new Date(o.placed_at).toLocaleString()}</div>
          </div>
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        </div>
        {o.status === "cancelled" && o.cancel_reason && <div className="mt-2 truncate text-caption text-destructive">Cancelled: {o.cancel_reason}</div>}
      </>
    );
    const cls = "press block rounded-xl border border-border/70 bg-card p-3";
    return detail === "customer" ? (
      <Link to="/customer/orders/$id" params={{ id: o.id }} className={cls}>{content}</Link>
    ) : (
      <Link to="/orders/$id" params={{ id: o.id }} className={cls}>{content}</Link>
    );
  };

  return (
    <div className="space-y-4 px-4 pb-6 pt-4 md:px-6">
      <h1 className="large-title">Orders</h1>
      {orders.isLoading ? (
        <div className="space-y-2.5">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : orders.data?.length === 0 ? (
        <div className="py-20 text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-tint-mint text-primary-ink">
            <Package className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <h2 className="mt-4 text-subtitle font-semibold">No orders yet</h2>
          <p className="mt-1 text-meta text-muted-foreground">Your orders from local shops will show up here.</p>
          <Link to="/products" className="press mt-5 inline-flex h-11 items-center rounded-xl bg-primary px-6 text-body font-semibold text-primary-foreground">Start shopping</Link>
        </div>
      ) : (
        <div className="space-y-2.5">{orders.data?.map((o: any) => <Row key={o.id} o={o} />)}</div>
      )}
    </div>
  );
}
