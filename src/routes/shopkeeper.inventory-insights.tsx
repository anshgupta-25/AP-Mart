import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  Package,
  Boxes,
  IndianRupee,
  AlertTriangle,
  XCircle,
  Clock,
  CalendarClock,
  Search,
  Download,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  TrendingDown,
  Sparkles,
  BarChart3,
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { rupees } from "@/lib/format";
import { StorageImg } from "@/components/StorageImg";

export const Route = createFileRoute("/shopkeeper/inventory-insights")({
  head: () => ({ meta: [{ title: "Inventory Insights — Shopkeeper" }] }),
  component: Page,
});

type InvRow = {
  id: string;
  price: number;
  stock: number;
  initial_stock: number | null;
  expiry_date: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
  product_id: string;
  products: {
    id: string;
    name: string;
    unit: string;
    image_url: string | null;
    cover_image: string | null;
    category_id: string | null;
    categories?: { name: string } | null;
  } | null;
};

type SaleRow = {
  product_id: string;
  name: string;
  image_url: string | null;
  quantity: number;
  price: number;
  variant_label: string | null;
  order_id: string;
  created_at: string;
  status: string;
};

const LOW_STOCK_THRESHOLD = 5;

function daysBetween(d: string | null): number | null {
  if (!d) return null;
  const t = new Date(d).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(t / 86400000);
}

function statusOf(row: InvRow): { label: string; tone: string } {
  const dl = daysBetween(row.expiry_date);
  if (dl !== null && dl < 0) return { label: "Expired", tone: "bg-tint-rose text-destructive" };
  if (row.stock <= 0) return { label: "Out of Stock", tone: "bg-tint-rose text-destructive" };
  if (dl !== null && dl <= 7)
    return { label: "Expiring Soon", tone: "bg-tint-sun text-warning-foreground" };
  if (row.stock <= LOW_STOCK_THRESHOLD)
    return { label: "Low Stock", tone: "bg-tint-sun text-warning-foreground" };
  return { label: "Fresh", tone: "bg-primary-soft text-primary-ink" };
}

function toCsv(rows: Record<string, unknown>[]): string {
  if (!rows.length) return "";
  const keys = Object.keys(rows[0]);
  const esc = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  return [keys.join(","), ...rows.map((r) => keys.map((k) => esc(r[k])).join(","))].join("\n");
}

function download(name: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

function Page() {
  const { user } = useAuth();
  const [shopId, setShopId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string>("all");
  const [stockFilter, setStockFilter] = useState<string>("all");
  const [expiryFilter, setExpiryFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("newest");
  const [range, setRange] = useState<"today" | "week" | "month" | "year">("week");
  const [selected, setSelected] = useState<InvRow | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("shops")
      .select("id")
      .eq("owner_id", user.id)
      .order("name")
      .limit(1)
      .then(({ data }) => setShopId(data?.[0]?.id ?? null));
  }, [user]);

  const inventory = useQuery({
    queryKey: ["insights-inv", shopId],
    queryFn: async () => {
      if (!shopId) return [] as InvRow[];
      const { data, error } = await supabase
        .from("shop_products")
        .select(
          "id, price, stock, initial_stock, expiry_date, is_available, created_at, updated_at, product_id, products(id, name, unit, image_url, cover_image, category_id, categories(name))",
        )
        .eq("shop_id", shopId)
        .limit(1000);
      if (error) throw error;
      return (data ?? []) as any as InvRow[];
    },
    enabled: !!shopId,
  });

  const sales = useQuery({
    queryKey: ["insights-sales", shopId, range],
    queryFn: async () => {
      if (!shopId) return [] as SaleRow[];
      const days = range === "today" ? 1 : range === "week" ? 7 : range === "month" ? 30 : 365;
      const since = new Date(Date.now() - days * 86400000).toISOString();
      const { data, error } = await supabase
        .from("orders")
        .select(
          "id, status, placed_at, order_items!order_items_order_id_fkey(product_id, name, image_url, quantity, price, variant_label)",
        )
        .eq("shop_id", shopId)
        .gte("placed_at", since)
        .limit(2000);
      if (error) throw error;
      const rows: SaleRow[] = [];
      for (const o of (data ?? []) as any[]) {
        for (const it of o.order_items ?? []) {
          rows.push({
            product_id: it.product_id,
            name: it.name,
            image_url: it.image_url,
            quantity: it.quantity,
            price: Number(it.price),
            variant_label: it.variant_label,
            order_id: o.id,
            created_at: o.placed_at,
            status: o.status,
          });
        }
      }
      return rows;
    },
    enabled: !!shopId,
  });

  const items = inventory.data ?? [];
  const salesRows = sales.data ?? [];
  const completedSales = salesRows.filter((s) => s.status === "delivered");

  const summary = useMemo(() => {
    const totalStock = items.reduce((a, b) => a + (b.stock || 0), 0);
    const totalValue = items.reduce((a, b) => a + (b.stock || 0) * Number(b.price || 0), 0);
    const low = items.filter((i) => i.stock > 0 && i.stock <= LOW_STOCK_THRESHOLD).length;
    const out = items.filter((i) => i.stock <= 0).length;
    const expired = items.filter((i) => {
      const d = daysBetween(i.expiry_date);
      return d !== null && d < 0;
    }).length;
    const exp7 = items.filter((i) => {
      const d = daysBetween(i.expiry_date);
      return d !== null && d >= 0 && d <= 7;
    }).length;
    return { total: items.length, totalStock, totalValue, low, out, expired, exp7 };
  }, [items]);

  const categories = useMemo(() => {
    const m = new Map<string, string>();
    for (const i of items) {
      if (i.products?.category_id && i.products?.categories?.name) {
        m.set(i.products.category_id, i.products.categories.name);
      }
    }
    return Array.from(m, ([id, name]) => ({ id, name }));
  }, [items]);

  const salesByProduct = useMemo(() => {
    const m = new Map<
      string,
      { units: number; revenue: number; orders: Set<string>; name: string; image: string | null }
    >();
    for (const s of completedSales) {
      const cur = m.get(s.product_id) ?? {
        units: 0,
        revenue: 0,
        orders: new Set<string>(),
        name: s.name,
        image: s.image_url,
      };
      cur.units += s.quantity;
      cur.revenue += s.quantity * s.price;
      cur.orders.add(s.order_id);
      m.set(s.product_id, cur);
    }
    return Array.from(m, ([id, v]) => ({
      id,
      name: v.name,
      image: v.image,
      units: v.units,
      revenue: v.revenue,
      orders: v.orders.size,
    }));
  }, [completedSales]);

  const bestSelling = useMemo(
    () => [...salesByProduct].sort((a, b) => b.units - a.units).slice(0, 10),
    [salesByProduct],
  );

  const lowestSelling = useMemo(() => {
    // include zero-sale products too
    const soldIds = new Set(salesByProduct.map((s) => s.id));
    const zeros = items
      .filter((i) => !soldIds.has(i.product_id) && i.products)
      .map((i) => ({
        id: i.product_id,
        name: i.products!.name,
        image: i.products!.image_url,
        units: 0,
        revenue: 0,
        orders: 0,
      }));
    return [...zeros, ...[...salesByProduct].sort((a, b) => a.units - b.units)].slice(0, 10);
  }, [salesByProduct, items]);

  const filtered = useMemo(() => {
    let out = [...items];
    if (q.trim())
      out = out.filter((i) => i.products?.name?.toLowerCase().includes(q.toLowerCase()));
    if (catFilter !== "all") out = out.filter((i) => i.products?.category_id === catFilter);
    if (stockFilter !== "all")
      out = out.filter((i) => {
        if (stockFilter === "out") return i.stock <= 0;
        if (stockFilter === "low") return i.stock > 0 && i.stock <= LOW_STOCK_THRESHOLD;
        if (stockFilter === "in") return i.stock > LOW_STOCK_THRESHOLD;
        return true;
      });
    if (expiryFilter !== "all")
      out = out.filter((i) => {
        const d = daysBetween(i.expiry_date);
        if (expiryFilter === "expired") return d !== null && d < 0;
        if (expiryFilter === "today") return d === 0;
        if (expiryFilter === "7") return d !== null && d >= 0 && d <= 7;
        if (expiryFilter === "30") return d !== null && d >= 0 && d <= 30;
        if (expiryFilter === "none") return !i.expiry_date;
        return true;
      });
    const salesById = new Map(salesByProduct.map((s) => [s.id, s.units]));
    if (sortBy === "newest") out.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (sortBy === "oldest") out.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    if (sortBy === "best")
      out.sort((a, b) => (salesById.get(b.product_id) ?? 0) - (salesById.get(a.product_id) ?? 0));
    if (sortBy === "lowest")
      out.sort((a, b) => (salesById.get(a.product_id) ?? 0) - (salesById.get(b.product_id) ?? 0));
    return out;
  }, [items, q, catFilter, stockFilter, expiryFilter, sortBy, salesByProduct]);

  const expiryGroups = useMemo(() => {
    const g = {
      expired: [] as InvRow[],
      today: [] as InvRow[],
      week: [] as InvRow[],
      month: [] as InvRow[],
    };
    for (const i of items) {
      const d = daysBetween(i.expiry_date);
      if (d === null) continue;
      if (d < 0) g.expired.push(i);
      else if (d === 0) g.today.push(i);
      else if (d <= 7) g.week.push(i);
      else if (d <= 30) g.month.push(i);
    }
    return g;
  }, [items]);

  const movementChart = useMemo(() => {
    const days = range === "today" ? 1 : range === "week" ? 7 : range === "month" ? 30 : 12;
    const bucketBy: "hour" | "day" | "month" =
      range === "today" ? "hour" : range === "year" ? "month" : "day";
    const buckets = new Map<string, { key: string; sold: number; revenue: number }>();
    const fmt = (d: Date) => {
      if (bucketBy === "hour") return `${d.getHours()}:00`;
      if (bucketBy === "month") return d.toLocaleString(undefined, { month: "short" });
      return d.toLocaleString(undefined, { month: "short", day: "numeric" });
    };
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      if (bucketBy === "hour") d.setHours(now.getHours() - i);
      else if (bucketBy === "month") d.setMonth(now.getMonth() - i);
      else d.setDate(now.getDate() - i);
      const k = fmt(d);
      buckets.set(k, { key: k, sold: 0, revenue: 0 });
    }
    for (const s of completedSales) {
      const k = fmt(new Date(s.created_at));
      const b = buckets.get(k);
      if (b) {
        b.sold += s.quantity;
        b.revenue += s.quantity * s.price;
      }
    }
    return Array.from(buckets.values());
  }, [completedSales, range]);

  const insights = useMemo(() => {
    const list: { icon: React.ElementType; text: string; tone: string }[] = [];
    if (bestSelling[0])
      list.push({
        icon: TrendingUp,
        text: `${bestSelling[0].name} is your top seller with ${bestSelling[0].units} units and ${rupees(bestSelling[0].revenue)} revenue.`,
        tone: "bg-tint-mint text-foreground",
      });
    const runningOut = items
      .filter((i) => i.stock > 0 && i.stock <= LOW_STOCK_THRESHOLD)
      .slice(0, 3);
    for (const r of runningOut)
      list.push({
        icon: AlertTriangle,
        text: `${r.products?.name} is low on stock — only ${r.stock} left.`,
        tone: "bg-tint-sun text-foreground",
      });
    if (summary.exp7 > 0)
      list.push({
        icon: CalendarClock,
        text: `${summary.exp7} product(s) expire in the next 7 days.`,
        tone: "bg-tint-sun text-foreground",
      });
    if (summary.expired > 0)
      list.push({
        icon: XCircle,
        text: `${summary.expired} product(s) already expired — remove or discount.`,
        tone: "bg-tint-rose text-foreground",
      });
    const stale = lowestSelling.filter((l) => l.units === 0).slice(0, 2);
    for (const s of stale)
      list.push({
        icon: TrendingDown,
        text: `${s.name} hasn't sold recently — consider a 10–15% discount.`,
        tone: "bg-secondary text-foreground",
      });
    if (list.length === 0)
      list.push({
        icon: Sparkles,
        text: "Your inventory looks healthy. Keep it up!",
        tone: "bg-tint-mint text-foreground",
      });
    return list;
  }, [bestSelling, items, summary, lowestSelling]);

  const exportRows = filtered.map((i) => {
    const st = statusOf(i);
    const dl = daysBetween(i.expiry_date);
    return {
      name: i.products?.name ?? "",
      category: i.products?.categories?.name ?? "",
      unit: i.products?.unit ?? "",
      current_stock: i.stock,
      initial_stock: i.initial_stock ?? i.stock,
      price: i.price,
      value: i.stock * Number(i.price),
      added_on: new Date(i.created_at).toLocaleDateString(),
      expiry_date: i.expiry_date ?? "",
      days_left: dl ?? "",
      status: st.label,
    };
  });

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 md:px-6">
        {/* Header */}
        <div className="flex items-center gap-3 flex-wrap">
          <Button asChild variant="ghost" size="sm">
            <Link to="/shopkeeper/products">
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back
            </Link>
          </Button>
          <div className="flex-1">
            <h1 className="large-title">Insights</h1>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => download(`inventory-${Date.now()}.csv`, toCsv(exportRows), "text/csv")}
            >
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                download(
                  `inventory-${Date.now()}.xls`,
                  toCsv(exportRows),
                  "application/vnd.ms-excel",
                )
              }
            >
              <FileSpreadsheet className="h-4 w-4 mr-1" />
              Excel
            </Button>
            <Button size="sm" variant="outline" onClick={() => window.print()}>
              <FileText className="h-4 w-4 mr-1" />
              PDF
            </Button>
          </div>
        </div>

        {!shopId ? (
          <p className="rounded-xl bg-card px-6 py-10 text-center text-body text-muted-foreground border border-border/70">
            No shop assigned to your account.
          </p>
        ) : (
          <>
            {/* SECTION 1: Overview */}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-7">
              <KpiCard
                icon={<Package />}
                label="Total Products"
                value={summary.total}
                tone="bg-primary-soft text-primary-ink"
              />
              <KpiCard
                icon={<Boxes />}
                label="Total Stock"
                value={summary.totalStock}
                tone="bg-secondary text-foreground"
              />
              <KpiCard
                icon={<IndianRupee />}
                label="Inventory Value"
                value={rupees(summary.totalValue)}
                tone="bg-tint-sky text-foreground"
              />
              <KpiCard
                icon={<AlertTriangle />}
                label="Low Stock"
                value={summary.low}
                tone="bg-tint-sun text-warning-foreground"
              />
              <KpiCard
                icon={<XCircle />}
                label="Out of Stock"
                value={summary.out}
                tone="bg-tint-rose text-destructive"
              />
              <KpiCard
                icon={<Clock />}
                label="Expired"
                value={summary.expired}
                tone="bg-tint-rose text-destructive"
              />
              <KpiCard
                icon={<CalendarClock />}
                label="Expiring ≤ 7 days"
                value={summary.exp7}
                tone="bg-tint-sun text-warning-foreground"
              />
            </div>

            {/* SECTION 9: AI Insights */}
            <div className="rounded-xl bg-card p-4 border border-border/70">
              <div className="mb-3 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                <h2 className="section-title">Business insights</h2>
              </div>
              <div className="grid gap-2 md:grid-cols-2">
                {insights.map((i, idx) => (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 rounded-xl p-3.5 text-body leading-snug ${i.tone}`}
                  >
                    <i.icon className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{i.text}</span>
                  </div>
                ))}
              </div>
            </div>

            <Tabs defaultValue="products" className="w-full">
              <div className="w-full overflow-x-auto -mx-1 px-1">
                <TabsList className="inline-flex md:grid md:grid-cols-5 md:w-full w-max gap-1">
                  <TabsTrigger value="products" className="whitespace-nowrap">
                    Products
                  </TabsTrigger>
                  <TabsTrigger value="best" className="whitespace-nowrap">
                    Best Selling
                  </TabsTrigger>
                  <TabsTrigger value="lowest" className="whitespace-nowrap">
                    Lowest Selling
                  </TabsTrigger>
                  <TabsTrigger value="expiry" className="whitespace-nowrap">
                    Expiry
                  </TabsTrigger>
                  <TabsTrigger value="movement" className="whitespace-nowrap">
                    Movement
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* SECTION 2 + 8: Products table with filters */}
              <TabsContent value="products" className="mt-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-6 gap-2">
                  <div className="relative md:col-span-2">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={q}
                      onChange={(e) => setQ(e.target.value)}
                      placeholder="Search products"
                      className="pl-10"
                    />
                  </div>
                  <Select value={catFilter} onValueChange={setCatFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All categories</SelectItem>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={stockFilter} onValueChange={setStockFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Stock" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All stock</SelectItem>
                      <SelectItem value="in">In stock</SelectItem>
                      <SelectItem value="low">Low stock</SelectItem>
                      <SelectItem value="out">Out of stock</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={expiryFilter} onValueChange={setExpiryFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="Expiry" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All expiry</SelectItem>
                      <SelectItem value="expired">Expired</SelectItem>
                      <SelectItem value="today">Expiring today</SelectItem>
                      <SelectItem value="7">≤ 7 days</SelectItem>
                      <SelectItem value="30">≤ 30 days</SelectItem>
                      <SelectItem value="none">No expiry set</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={setSortBy}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sort" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="newest">Newest</SelectItem>
                      <SelectItem value="oldest">Oldest</SelectItem>
                      <SelectItem value="best">Best selling</SelectItem>
                      <SelectItem value="lowest">Lowest selling</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card md:hidden">
                  {filtered.map((i) => {
                    const st = statusOf(i);
                    const dl = daysBetween(i.expiry_date);
                    return (
                      <button
                        key={i.id}
                        type="button"
                        onClick={() => setSelected(i)}
                        className="press flex w-full items-center gap-3 p-3 text-left"
                      >
                        {i.products?.image_url ? (
                          <StorageImg
                            loading="lazy"
                            decoding="async"
                            src={i.products.image_url}
                            className="h-11 w-11 shrink-0 rounded-lg object-cover"
                            alt=""
                          />
                        ) : (
                          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-secondary">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-body font-semibold">{i.products?.name}</div>
                          <div className="truncate text-small text-muted-foreground">
                            {i.products?.unit} · {i.stock} in stock
                            {dl !== null ? ` · ${dl}d left` : ""}
                          </div>
                        </div>
                        <Badge className={st.tone} variant="secondary">
                          {st.label}
                        </Badge>
                      </button>
                    );
                  })}
                  {filtered.length === 0 && (
                    <div className="p-8 text-center text-meta text-muted-foreground">
                      No products match your filters.
                    </div>
                  )}
                </div>

                <div className="hidden overflow-x-auto rounded-xl bg-card border border-border/70 md:block">
                  <table className="w-full text-body">
                    <thead className="bg-secondary/50 text-small font-medium text-muted-foreground">
                      <tr>
                        <th className="p-3.5 text-left font-medium">Product</th>
                        <th className="p-3.5 text-left font-medium">Category</th>
                        <th className="p-3.5 text-right font-medium">Stock</th>
                        <th className="p-3.5 text-right font-medium">Initial</th>
                        <th className="p-3.5 text-left font-medium">Added</th>
                        <th className="p-3.5 text-left font-medium">Expiry</th>
                        <th className="p-3.5 text-right font-medium">Days Left</th>
                        <th className="p-3.5 text-left font-medium">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((i) => {
                        const st = statusOf(i);
                        const dl = daysBetween(i.expiry_date);
                        return (
                          <tr
                            key={i.id}
                            onClick={() => setSelected(i)}
                            className="cursor-pointer border-t border-border/60 hover:bg-secondary/50"
                          >
                            <td className="p-3">
                              <div className="flex items-center gap-2">
                                {i.products?.image_url ? (
                                  <StorageImg
                                    loading="lazy"
                                    decoding="async"
                                    src={i.products.image_url}
                                    className="h-9 w-9 rounded-lg object-cover"
                                    alt=""
                                  />
                                ) : (
                                  <div className="h-9 w-9 rounded-lg bg-secondary grid place-items-center">
                                    <Package className="h-4 w-4 text-muted-foreground" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-semibold">{i.products?.name}</div>
                                  <div className="text-xs text-muted-foreground">
                                    {i.products?.unit}
                                  </div>
                                </div>
                              </div>
                            </td>
                            <td className="p-3">{i.products?.categories?.name ?? "—"}</td>
                            <td className="p-3 text-right font-semibold">{i.stock}</td>
                            <td className="p-3 text-right text-muted-foreground">
                              {i.initial_stock ?? i.stock}
                            </td>
                            <td className="p-3">{new Date(i.created_at).toLocaleDateString()}</td>
                            <td className="p-3">
                              {i.expiry_date ? (
                                new Date(i.expiry_date).toLocaleDateString()
                              ) : (
                                <span className="text-muted-foreground">—</span>
                              )}
                            </td>
                            <td className="p-3 text-right">{dl === null ? "—" : dl}</td>
                            <td className="p-3">
                              <Badge className={st.tone} variant="secondary">
                                {st.label}
                              </Badge>
                            </td>
                          </tr>
                        );
                      })}
                      {filtered.length === 0 && (
                        <tr>
                          <td className="p-8 text-center text-muted-foreground" colSpan={8}>
                            No products match your filters.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </TabsContent>

              {/* SECTION 3: Best Selling */}
              <TabsContent value="best" className="mt-4">
                <div className="rounded-xl bg-card p-4 border border-border/70">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingUp className="h-5 w-5 text-primary" />
                    <h2 className="section-title">Top 10 best selling</h2>
                    <span className="text-xs text-muted-foreground ml-auto">({range})</span>
                  </div>
                  {bestSelling.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No sales yet in this period.</p>
                  ) : (
                    <ul className="space-y-2">
                      {bestSelling.map((b, idx) => (
                        <li
                          key={b.id}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50"
                        >
                          <span className="w-6 text-center text-body font-semibold text-muted-foreground">
                            {idx + 1}
                          </span>
                          {b.image ? (
                            <StorageImg
                              loading="lazy"
                              decoding="async"
                              src={b.image}
                              className="h-10 w-10 rounded-lg object-cover"
                              alt=""
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-secondary" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{b.name}</div>
                            <div className="text-xs text-muted-foreground">{b.orders} orders</div>
                          </div>
                          <div className="text-right">
                            <div className="font-bold">{b.units} sold</div>
                            <div className="text-meta font-semibold text-primary-ink">
                              {rupees(b.revenue)}
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>

              {/* SECTION 4: Lowest Selling */}
              <TabsContent value="lowest" className="mt-4">
                <div className="rounded-xl bg-card p-4 border border-border/70">
                  <div className="flex items-center gap-2 mb-3">
                    <TrendingDown className="h-5 w-5 text-destructive" />
                    <h2 className="section-title">Lowest selling</h2>
                  </div>
                  {lowestSelling.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No data.</p>
                  ) : (
                    <ul className="space-y-2">
                      {lowestSelling.map((l) => (
                        <li
                          key={l.id}
                          className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/50"
                        >
                          {l.image ? (
                            <StorageImg
                              loading="lazy"
                              decoding="async"
                              src={l.image}
                              className="h-10 w-10 rounded-lg object-cover"
                              alt=""
                            />
                          ) : (
                            <div className="h-10 w-10 rounded-lg bg-secondary" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="font-semibold truncate">{l.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {l.units === 0 ? "No sales this period" : `Only ${l.units} sold`}
                            </div>
                          </div>
                          <div className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs text-muted-foreground">
                            <TrendingDown className="h-3 w-3" /> Try a discount
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </TabsContent>

              {/* SECTION 5: Expiry Information */}
              <TabsContent value="expiry" className="mt-4 grid gap-3 md:grid-cols-2">
                <ExpiryGroup
                  title="Expired"
                  rows={expiryGroups.expired}
                  tone="border-destructive/30"
                />
                <ExpiryGroup
                  title="Expiring Today"
                  rows={expiryGroups.today}
                  tone="border-warning/40"
                />
                <ExpiryGroup
                  title="Within 7 Days"
                  rows={expiryGroups.week}
                  tone="border-warning/40"
                />
                <ExpiryGroup
                  title="Within 30 Days"
                  rows={expiryGroups.month}
                  tone="border-success/30"
                />
                {items.every((i) => !i.expiry_date) && (
                  <div className="rounded-xl bg-card p-8 text-center text-body text-muted-foreground border border-border/70 md:col-span-2">
                    No expiry dates set for your inventory. Add expiry dates when editing products
                    to track perishables here.
                  </div>
                )}
              </TabsContent>

              {/* SECTION 6: Stock Movement */}
              <TabsContent value="movement" className="mt-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-semibold">Range:</span>
                  {(["today", "week", "month", "year"] as const).map((r) => (
                    <Button
                      key={r}
                      size="sm"
                      variant={range === r ? "default" : "outline"}
                      onClick={() => setRange(r)}
                    >
                      {r[0].toUpperCase() + r.slice(1)}
                    </Button>
                  ))}
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl bg-card p-4 border border-border/70">
                    <h3 className="section-title mb-3">Products sold</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={movementChart}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="key" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Legend />
                        <Bar dataKey="sold" fill="hsl(var(--primary))" name="Units sold" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="rounded-xl bg-card p-4 border border-border/70">
                    <h3 className="section-title mb-3">Revenue</h3>
                    <ResponsiveContainer width="100%" height={240}>
                      <LineChart data={movementChart}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="key" fontSize={11} />
                        <YAxis fontSize={11} />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="revenue"
                          stroke="oklch(0.58 0.15 152)"
                          name="Revenue ₹"
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </>
        )}

        {/* SECTION 7: Product Timeline dialog */}
        <Dialog open={!!selected} onOpenChange={(v) => !v && setSelected(null)}>
          {selected && (
            <TimelineDialog
              row={selected}
              sales={completedSales.filter((s) => s.product_id === selected.product_id)}
            />
          )}
        </Dialog>
      </div>
    </>
  );
}

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  tone: string;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3.5">
      <div className={`grid h-9 w-9 place-items-center rounded-lg ${tone}`}>{icon}</div>
      <div className="mt-2.5 text-small text-muted-foreground">{label}</div>
      <div className="text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

function ExpiryGroup({ title, rows, tone }: { title: string; rows: InvRow[]; tone: string }) {
  return (
    <div className={`rounded-xl bg-card p-4 border border-border/70`}>
      <h3 className="section-title mb-3">
        {title} <span className="text-muted-foreground text-sm font-normal">({rows.length})</span>
      </h3>
      {rows.length === 0 ? (
        <p className="text-xs text-muted-foreground">None.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((r) => {
            const dl = daysBetween(r.expiry_date);
            return (
              <li key={r.id} className="flex items-center gap-2 text-sm">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{r.products?.name}</div>
                  <div className="text-xs text-muted-foreground">
                    Stock: {r.stock} · Exp: {r.expiry_date}
                  </div>
                </div>
                <div className="text-xs font-semibold">
                  {dl === null ? "—" : dl < 0 ? `${Math.abs(dl)}d ago` : `${dl}d left`}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function TimelineDialog({ row, sales }: { row: InvRow; sales: SaleRow[] }) {
  const totalSold = sales.reduce((a, b) => a + b.quantity, 0);
  const totalRev = sales.reduce((a, b) => a + b.quantity * b.price, 0);
  const lastSale = sales.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))[0];
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          {row.products?.image_url && (
            <StorageImg
              loading="lazy"
              decoding="async"
              src={row.products.image_url}
              className="h-10 w-10 rounded-lg object-cover"
              alt=""
            />
          )}
          {row.products?.name}
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-3 text-sm">
        <div className="grid grid-cols-2 gap-2">
          <TimelineRow label="Created" value={new Date(row.created_at).toLocaleString()} />
          <TimelineRow label="Last Updated" value={new Date(row.updated_at).toLocaleString()} />
          <TimelineRow label="Initial Stock Added" value={String(row.initial_stock ?? row.stock)} />
          <TimelineRow label="Current Stock" value={String(row.stock)} />
          <TimelineRow label="Expiry Date" value={row.expiry_date ?? "—"} />
          <TimelineRow
            label="Last Sale"
            value={lastSale ? new Date(lastSale.created_at).toLocaleString() : "No sales yet"}
          />
          <TimelineRow label="Units Sold (period)" value={String(totalSold)} />
          <TimelineRow label="Revenue (period)" value={rupees(totalRev)} />
        </div>
        <div>
          <h4 className="font-semibold mb-1">Sales history</h4>
          {sales.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              No sales recorded in the selected period.
            </p>
          ) : (
            <ul className="divide-y divide-border/60 overflow-hidden rounded-xl bg-secondary">
              {sales.slice(0, 20).map((s, idx) => (
                <li key={idx} className="p-2 flex items-center justify-between text-xs">
                  <span>{new Date(s.created_at).toLocaleString()}</span>
                  <span className="font-semibold">
                    {s.quantity} × {rupees(s.price)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </DialogContent>
  );
}

function TimelineRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border p-2">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-semibold">{value}</div>
    </div>
  );
}
