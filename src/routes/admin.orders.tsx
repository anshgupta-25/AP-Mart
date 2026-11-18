import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { rupees } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { DeliveryTypeBadge } from "@/components/FastDeliveryBadge";
import {
  Filter,
  ImageOff,
  MapPin,
  Phone,
  Search,
  SearchX,
  Store,
  Truck,
  User,
  X,
} from "lucide-react";
import { StorageImg } from "@/components/StorageImg";
import { asAddress } from "@/lib/address";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

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

// Values stored in orders.delivery_type (see place_order), with readable labels.
const DELIVERY_TYPES: { value: string; label: string }[] = [
  { value: "standard_delivery", label: "Standard" },
  { value: "fast_delivery", label: "Fast" },
  { value: "express_delivery", label: "Express" },
  { value: "pickup", label: "Pickup" },
];
const PAYMENT_STATUSES = ["pending", "paid", "failed", "refund_initiated", "refunded", "cod"];

/** "YYYY-MM-DD" of a timestamp in the viewer's time zone (matches the date picker). */
const localDay = (iso: string | null | undefined) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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
      const list = orders ?? [];
      const ids = list.map((o) => o.id);

      const [itemsRes, shopsRes, partnersRes] = await Promise.all([
        ids.length
          ? supabase
              .from("order_items")
              .select(
                "id, order_id, child_order_id, name, image_url, unit, variant_label, quantity, price, shop_id",
              )
              .in("order_id", ids)
          : Promise.resolve({ data: [] }),
        supabase.rpc("admin_list_shops"),
        supabase.from("delivery_partners").select("id, name, phone, vehicle"),
      ]);

      const itemsByOrder = new Map<string, any[]>();
      for (const it of itemsRes.data ?? []) {
        const arr = itemsByOrder.get(it.order_id) ?? [];
        arr.push(it);
        itemsByOrder.set(it.order_id, arr);
      }
      const shopMap = new Map((shopsRes.data ?? []).map((s) => [s.id, s]));
      const partnerMap = new Map((partnersRes.data ?? []).map((p) => [p.id, p]));

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
    rows.forEach((o) => o.shop && m.set(o.shop.id, o.shop.name));
    return [...m.entries()];
  }, [rows]);
  const partnerOptions = useMemo(() => {
    const m = new Map<string, string>();
    rows.forEach((o) => o.partner && m.set(o.partner.id, o.partner.name));
    return [...m.entries()];
  }, [rows]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((o) => {
      const a = asAddress(o.address);
      if (status !== "all" && o.status !== status) return false;
      if (shopId !== "all" && o.shop_id !== shopId) return false;
      if (partnerId !== "all" && o.partner_id !== partnerId) return false;
      if (payStatus !== "all" && o.payment_status !== payStatus) return false;
      if (delType !== "all" && (o.delivery_type ?? "standard_delivery") !== delType) return false;
      if (pincode && !String(o.delivery_pincode ?? a.pincode ?? "").includes(pincode.trim()))
        return false;
      if (date && localDay(o.placed_at) !== date) return false;
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
        ...(o.items ?? []).map((i) => i.name),
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

  const selectCls = "h-10 w-full rounded-xl border-0 bg-secondary px-3 text-meta font-medium";
  const [filtersOpen, setFiltersOpen] = useState(false);
  const clearSecondary = () => {
    setShopId("all");
    setPartnerId("all");
    setPayStatus("all");
    setDelType("all");
    setPincode("");
    setDate("");
  };

  // Count active secondary filters for badge
  const activeFilterCount = [
    shopId !== "all",
    partnerId !== "all",
    payStatus !== "all",
    delType !== "all",
    !!pincode,
    !!date,
  ].filter(Boolean).length;

  // Active filter tags (secondary filters only)
  const activeTags: { key: string; label: string; clear: () => void }[] = [
    ...(shopId !== "all"
      ? [
          {
            key: "shop",
            label: `Shop: ${shopOptions.find(([id]) => id === shopId)?.[1] ?? shopId}`,
            clear: () => setShopId("all"),
          },
        ]
      : []),
    ...(partnerId !== "all"
      ? [
          {
            key: "rider",
            label: `Rider: ${partnerOptions.find(([id]) => id === partnerId)?.[1] ?? partnerId}`,
            clear: () => setPartnerId("all"),
          },
        ]
      : []),
    ...(payStatus !== "all"
      ? [
          {
            key: "pay",
            label: `Payment: ${payStatus.replace(/_/g, " ")}`,
            clear: () => setPayStatus("all"),
          },
        ]
      : []),
    ...(delType !== "all"
      ? [
          {
            key: "del",
            label: `Delivery: ${DELIVERY_TYPES.find((t) => t.value === delType)?.label ?? delType}`,
            clear: () => setDelType("all"),
          },
        ]
      : []),
    ...(pincode ? [{ key: "pin", label: `PIN: ${pincode}`, clear: () => setPincode("") }] : []),
    ...(date ? [{ key: "date", label: `Date: ${date}`, clear: () => setDate("") }] : []),
  ];

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
        {/* Row 1: Search + Filter button */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search order ID, customer, phone, shop, rider…"
              className="pl-10"
            />
          </div>
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="secondary" className="relative shrink-0 gap-2">
                <Filter className="h-4 w-4" />
                Filters
                {activeFilterCount > 0 && (
                  <span
                    aria-label={`${activeFilterCount} active`}
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white"
                  >
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent
              side="bottom"
              className="mx-auto max-h-[85vh] w-full max-w-xl overflow-y-auto rounded-t-2xl px-4 pb-8 pt-4"
            >
              <SheetHeader className="mb-4">
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <label htmlFor="f-shop" className="eyebrow">
                      Shop
                    </label>
                    <select
                      className={selectCls}
                      id="f-shop"
                      value={shopId}
                      onChange={(e) => setShopId(e.target.value)}
                    >
                      <option value="all">All shops</option>
                      {shopOptions.map(([id, name]) => (
                        <option key={id} value={id}>
                          {name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="f-rider" className="eyebrow">
                      Rider
                    </label>
                    <select
                      className={selectCls}
                      id="f-rider"
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
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="f-pay" className="eyebrow">
                      Payment
                    </label>
                    <select
                      className={selectCls}
                      id="f-pay"
                      value={payStatus}
                      onChange={(e) => setPayStatus(e.target.value)}
                    >
                      <option value="all">All</option>
                      {PAYMENT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {s.replace(/_/g, " ")}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="f-del" className="eyebrow">
                      Delivery type
                    </label>
                    <select
                      className={selectCls}
                      id="f-del"
                      value={delType}
                      onChange={(e) => setDelType(e.target.value)}
                    >
                      <option value="all">All</option>
                      {DELIVERY_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="f-pin" className="eyebrow">
                      PIN code
                    </label>
                    <Input
                      id="f-pin"
                      value={pincode}
                      onChange={(e) => setPincode(e.target.value)}
                      inputMode="numeric"
                      placeholder="e.g. 141001"
                      className="h-10"
                    />
                  </div>
                  <div className="space-y-1">
                    <label htmlFor="f-date" className="eyebrow">
                      Date
                    </label>
                    <Input
                      type="date"
                      id="f-date"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="h-10"
                    />
                  </div>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={clearSecondary}
                  disabled={activeFilterCount === 0}
                >
                  Clear all
                </Button>
                <Button className="flex-1" onClick={() => setFiltersOpen(false)}>
                  Show {filtered.length} {filtered.length === 1 ? "order" : "orders"}
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Row 2: Status chip rail */}
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-0.5">
          {[
            { value: "all", label: "All" },
            ...Object.entries(STATUS_BADGE).map(([v, { label }]) => ({ value: v, label })),
          ].map(({ value, label }) => (
            <button
              key={value}
              type="button"
              aria-pressed={status === value}
              onClick={() => setStatus(value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-caption font-semibold transition-colors ${
                status === value
                  ? "bg-primary text-white"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Active filter tags */}
        {activeTags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {activeTags.map((tag) => (
              <span
                key={tag.key}
                className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2.5 py-1 text-caption font-medium text-primary-ink"
              >
                {tag.label}
                <button
                  type="button"
                  onClick={tag.clear}
                  aria-label={`Remove filter ${tag.label}`}
                  className="ml-0.5 rounded-full p-0.5 hover:bg-primary/20"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Orders */}
      {q.isLoading ? (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-40 rounded-xl shimmer" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-xl border border-border/70 bg-card px-6 py-14 text-center">
          <SearchX className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
          <div className="text-subtitle font-semibold">No orders match your filters</div>
          <p className="mt-1 text-meta text-muted-foreground">
            Try adjusting or clearing the filters.
          </p>
          <Button variant="secondary" size="sm" className="mt-4" onClick={reset}>
            Reset all filters
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((o) => {
            const a = asAddress(o.address);
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
