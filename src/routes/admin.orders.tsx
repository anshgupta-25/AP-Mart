import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rupees } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeliveryTypeBadge } from "@/components/FastDeliveryBadge";
import { ImageOff, MapPin, Phone, Search, Store, Truck, User } from "lucide-react";
import { StorageImg } from "@/components/StorageImg";

export const Route = createFileRoute("/admin/orders")({
  head: () => ({
    meta: [
      { title: "All orders — AP Mart Admin" },
      {
        name: "description",
        content:
          "Complete marketplace order visibility: customers, shops, riders, products and payments.",
      },
      { property: "og:title", content: "All orders — AP Mart Admin" },
      {
        property: "og:description",
        content: "Complete marketplace order visibility for AP Mart admins.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Page,
});

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  placed: { label: "Placed", cls: "bg-tint-sun text-[oklch(0.45_0.1_75)]" },
  payment_confirmed: { label: "Payment confirmed", cls: "bg-tint-sun text-[oklch(0.45_0.1_75)]" },
  awaiting_shop: { label: "Awaiting shop", cls: "bg-tint-sun text-[oklch(0.45_0.1_75)]" },
  accepted_by_shop: { label: "Assigned", cls: "bg-primary-soft text-primary-ink" },
  packing: { label: "Preparing", cls: "bg-primary-soft text-primary-ink" },
  packed: { label: "Ready", cls: "bg-primary-soft text-primary-ink" },
  out_for_delivery: { label: "Out for delivery", cls: "bg-tint-sky text-[oklch(0.42_0.1_235)]" },
  delivered: { label: "Delivered", cls: "bg-primary-soft text-primary-ink" },
  cancelled: { label: "Cancelled", cls: "bg-tint-rose text-[oklch(0.45_0.12_15)]" },
  no_shop_available: { label: "No shop available", cls: "bg-tint-rose text-[oklch(0.45_0.12_15)]" },
};

const statusBadge = (s: string) =>
  STATUS_BADGE[s] ?? {
    label: String(s).replace(/_/g, " "),
    cls: "bg-secondary text-muted-foreground",
  };

function useAdminOrders() {
  return useQuery({
    queryKey: ["admin-orders-full"],
    refetchInterval: 30000,
    queryFn: async () => {
      const { data: orders } = await supabase
        .from("orders")
        .select("*")
        .order("placed_at", { ascending: false })
        .limit(200);
      const list = (orders ?? []) as any[];
      const ids = list.map((o) => o.id);

      const [itemsRes, shopsRes, partnersRes] = await Promise.all([
        ids.length
          ? supabase
              .from("order_items")
              .select(
                "id, order_id, child_order_id, name, image_url, unit, variant_label, quantity, price, shop_id",
              )
              .in("order_id", ids)
          : Promise.resolve({ data: [] as any[] }),
        supabase.rpc("admin_list_shops"),
        supabase.from("delivery_partners").select("id, name, phone, vehicle"),
      ]);

      const itemsByOrder = new Map<string, any[]>();
      for (const it of ((itemsRes as any).data ?? []) as any[]) {
        const arr = itemsByOrder.get(it.order_id) ?? [];
        arr.push(it);
        itemsByOrder.set(it.order_id, arr);
      }
      const shopMap = new Map(((shopsRes.data as any[]) ?? []).map((s: any) => [s.id, s]));
      const partnerMap = new Map(((partnersRes.data as any[]) ?? []).map((p: any) => [p.id, p]));

      return list.map((o) => ({
        ...o,
        items: itemsByOrder.get(o.id) ?? [],
        shop: o.shop_id ? (shopMap.get(o.shop_id) ?? null) : null,
        partner: o.partner_id ? (partnerMap.get(o.partner_id) ?? null) : null,
      }));
    },
  });
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-secondary px-2.5 py-1 text-caption font-medium text-muted-foreground">
      {children}
    </span>
  );
}

function ProductPreview({ items }: { items: any[] }) {
  if (!items.length) return null;
  const shown = items.slice(0, 3);
  const rest = items.length - shown.length;
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2">
      {shown.map((it) => (
        <span
          key={it.id}
          className="inline-flex items-center gap-2 rounded-xl bg-secondary/70 py-1 pl-1 pr-2.5 text-small"
        >
          <span className="h-7 w-7 rounded-lg overflow-hidden bg-muted flex items-center justify-center shrink-0">
            {it.image_url ? (
              <StorageImg
                src={it.image_url}
                alt={it.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover"
              />
            ) : (
              <ImageOff className="h-3 w-3 text-muted-foreground" />
            )}
          </span>
          <span className="max-w-[9rem] truncate font-medium">{it.name}</span>
          {(it.variant_label || it.unit) && (
            <span className="text-muted-foreground">
              ({[it.variant_label, it.unit].filter(Boolean).join(" ")})
            </span>
          )}
          <span className="font-semibold">×{it.quantity}</span>
        </span>
      ))}
      {rest > 0 && (
        <span className="text-xs font-semibold text-muted-foreground">+{rest} more products</span>
      )}
    </div>
  );
}

function Page() {
  const q = useAdminOrders();
  const rows = q.data ?? [];

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [shopId, setShopId] = useState("all");
  const [partnerId, setPartnerId] = useState("all");
  const [payStatus, setPayStatus] = useState("all");
  const [delType, setDelType] = useState("all");
  const [pincode, setPincode] = useState("");
  const [date, setDate] = useState("");

  const shopOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((o: any) => o.shop && m.set(o.shop.id, o.shop.name));
    return [...m.entries()];
  }, [rows]);
  const partnerOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((o: any) => o.partner && m.set(o.partner.id, o.partner.name));
    return [...m.entries()];
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((o: any) => {
      const a = (o.address ?? {}) as any;
      if (status !== "all" && o.status !== status) return false;
      if (shopId !== "all" && o.shop_id !== shopId) return false;
      if (partnerId !== "all" && o.partner_id !== partnerId) return false;
      if (payStatus !== "all" && o.payment_status !== payStatus) return false;
      if (delType !== "all" && (o.delivery_type ?? "standard") !== delType) return false;
      if (pincode && !String(o.delivery_pincode ?? a.pincode ?? "").includes(pincode.trim()))
        return false;
      if (date && !(o.placed_at ?? "").startsWith(date)) return false;
      if (!term) return true;
      const hay = [
        o.order_number,
        o.id,
        a.name,
        a.phone,
        a.pincode,
        o.shop?.name,
        o.shop?.owner_name,
        o.partner?.name,
        o.partner?.phone,
        ...(o.items ?? []).map((i: any) => i.name),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return hay.includes(term);
    });
  }, [rows, search, status, shopId, partnerId, payStatus, delType, pincode, date]);

  const reset = () => {
    setSearch("");
    setStatus("all");
    setShopId("all");
    setPartnerId("all");
    setPayStatus("all");
    setDelType("all");
    setPincode("");
    setDate("");
  };

  const selectCls = "h-10 rounded-xl border-0 bg-secondary px-3 text-meta font-medium";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4 md:px-6 md:py-6">
      <div>
        <h1 className="large-title">All orders</h1>
        <p className="mt-0.5 text-meta text-muted-foreground">
          {filtered.length} of {rows.length} orders
        </p>
      </div>

      {/* Search + filters */}
      <div className="space-y-3 rounded-xl border border-border/70 bg-card p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search order ID, customer, phone, shop, owner, product, rider…"
            className="pl-10"
          />
        </div>
        <div className="flex flex-wrap gap-2">
          <select className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="all">All statuses</option>
            {Object.keys(STATUS_BADGE).map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select className={selectCls} value={shopId} onChange={(e) => setShopId(e.target.value)}>
            <option value="all">All shops</option>
            {shopOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            className={selectCls}
            value={partnerId}
            onChange={(e) => setPartnerId(e.target.value)}
          >
            <option value="all">All riders</option>
            {partnerOptions.map(([id, name]) => (
              <option key={id} value={id}>
                {name}
              </option>
            ))}
          </select>
          <select
            className={selectCls}
            value={payStatus}
            onChange={(e) => setPayStatus(e.target.value)}
          >
            <option value="all">All payments</option>
            {["pending", "paid", "failed", "refund_initiated", "refunded", "cod"].map((s) => (
              <option key={s} value={s}>
                {s.replace(/_/g, " ")}
              </option>
            ))}
          </select>
          <select
            className={selectCls}
            value={delType}
            onChange={(e) => setDelType(e.target.value)}
          >
            <option value="all">All delivery types</option>
            {["standard", "fast", "express", "pickup"].map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          <Input
            value={pincode}
            onChange={(e) => setPincode(e.target.value)}
            placeholder="PIN code"
            className="h-10 w-28"
          />
          <Input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="h-10 w-40"
          />
          <Button variant="secondary" size="sm" className="h-10" onClick={reset}>
            Reset
          </Button>
        </div>
      </div>

      {/* Orders */}
      {q.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 rounded-xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card px-6 py-10 text-center">
          <div className="text-subtitle font-semibold">No orders found</div>
          <p className="mt-0.5 text-meta text-muted-foreground">
            Try changing or resetting the filters.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o: any) => {
            const a = (o.address ?? {}) as any;
            const b = statusBadge(o.status);
            return (
              <Link
                key={o.id}
                to="/admin/orders/$id"
                params={{ id: o.id }}
                className="press block rounded-xl border border-border/70 bg-card p-4 transition-colors hover:bg-secondary/40 md:p-5"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-subtitle font-semibold">{o.order_number}</span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${b.cls}`}
                      >
                        {b.label}
                      </span>
                      <DeliveryTypeBadge type={o.delivery_type} size="sm" />
                      {o.is_parent && <Chip>Multi-shop · {o.shop_count ?? 0} shops</Chip>}
                    </div>
                    <div className="mt-1 text-meta text-muted-foreground">
                      {o.placed_at ? new Date(o.placed_at).toLocaleString() : "—"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-semibold tracking-tight">{rupees(o.total)}</div>
                    <div className="text-small text-muted-foreground">
                      {String(o.payment_method ?? "")} ·{" "}
                      {String(o.payment_status ?? "").replace(/_/g, " ")}
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 border-t border-border/70 pt-4 text-meta sm:grid-cols-3">
                  <div className="space-y-1">
                    <div className="eyebrow">Customer</div>
                    <div className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                      {a.name ?? "—"}
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                      {a.phone ?? "—"}
                    </div>
                    <div className="flex items-start gap-1.5 text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                      <span>
                        {[a.line1, a.line2, a.city].filter(Boolean).join(", ") || "—"} —{" "}
                        {o.delivery_pincode ?? a.pincode ?? "—"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="eyebrow">Shop</div>
                    <div className="flex items-center gap-1.5">
                      <Store className="h-3.5 w-3.5 text-muted-foreground" />
                      {o.shop?.name ?? (o.is_parent ? "Multiple shops" : "Not assigned")}
                    </div>
                    <div className="text-muted-foreground">Owner: {o.shop?.owner_name ?? "—"}</div>
                    <div className="truncate font-mono text-micro text-muted-foreground">
                      ID: {o.shop_id ?? "—"}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <div className="eyebrow">Delivery partner</div>
                    <div className="flex items-center gap-1.5">
                      <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                      {o.partner?.name ?? "Not assigned"}
                    </div>
                    <div className="text-muted-foreground">{o.partner?.phone ?? "—"}</div>
                  </div>
                </div>

                <ProductPreview items={o.items} />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
