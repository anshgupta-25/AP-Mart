import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ResponsiveContainer, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";
import {
  Download, Search, TrendingUp, TrendingDown, Wallet, Package, XCircle,
  RotateCcw, CheckCircle2, Clock, Calendar as CalendarIcon, IndianRupee, FileText, Printer,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { rupees } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/shopkeeper/earnings")({
  head: () => ({ meta: [{ title: "Earnings — Shopkeeper" }] }),
  component: Page,
});

// ---------- date helpers ----------
type PresetKey =
  | "today" | "yesterday" | "last_7" | "last_30"
  | "this_week" | "this_month" | "last_month" | "this_year" | "custom";

const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0,0,0,0); return x; };
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23,59,59,999); return x; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const startOfWeek = (d: Date) => { const x = startOfDay(d); const day = (x.getDay()+6)%7; return addDays(x,-day); };

function presetRange(k: PresetKey, custom?: { from: string; to: string }) {
  const now = new Date();
  switch (k) {
    case "today": return { from: startOfDay(now), to: endOfDay(now), label: "Today" };
    case "yesterday": { const y = addDays(now,-1); return { from: startOfDay(y), to: endOfDay(y), label: "Yesterday" }; }
    case "last_7": return { from: startOfDay(addDays(now,-6)), to: endOfDay(now), label: "Last 7 Days" };
    case "last_30": return { from: startOfDay(addDays(now,-29)), to: endOfDay(now), label: "Last 30 Days" };
    case "this_week": return { from: startOfWeek(now), to: endOfDay(now), label: "This Week" };
    case "this_month": return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now), label: "This Month" };
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth()-1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(s), to: endOfDay(e), label: "Last Month" };
    }
    case "this_year": return { from: startOfDay(new Date(now.getFullYear(),0,1)), to: endOfDay(now), label: "This Year" };
    case "custom": {
      const f = custom?.from ? new Date(custom.from) : startOfDay(now);
      const t = custom?.to ? new Date(custom.to) : endOfDay(now);
      return { from: startOfDay(f), to: endOfDay(t), label: "Custom" };
    }
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "last_7", label: "Last 7 Days" },
  { key: "last_30", label: "Last 30 Days" },
  { key: "this_week", label: "This Week" },
  { key: "this_month", label: "This Month" },
  { key: "last_month", label: "Last Month" },
  { key: "this_year", label: "This Year" },
  { key: "custom", label: "Custom" },
];

// ---------- types ----------
type OrderRow = {
  id: string; order_number: string; placed_at: string; status: string;
  payment_method: string; payment_status: string;
  subtotal: number; discount: number; delivery_fee: number; fast_delivery_fee: number;
  handling_fee: number; tax: number; total: number;
  address: any; user_id: string;
};

const DELIVERED = new Set(["delivered"]);
const CANCELLED = new Set(["cancelled", "rejected", "no_shop_available"]);
const REFUNDED = new Set(["refunded"]);

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [shopId, setShopId] = useState<string | null>(null);
  const [preset, setPreset] = useState<PresetKey>("this_month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const [chartMetric, setChartMetric] = useState<"earnings" | "orders" | "profit" | "refunds">("earnings");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 10;

  const range = useMemo(() => presetRange(preset, custom), [preset, custom]);

  // Load shop
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase.from("shops").select("id").eq("owner_id", user.id).limit(1);
      setShopId(data?.[0]?.id ?? null);
    })();
  }, [user]);

  // Realtime refresh
  useEffect(() => {
    if (!shopId) return;
    const ch = supabase
      .channel("earnings-orders-" + shopId)
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `shop_id=eq.${shopId}` }, () => {
        qc.invalidateQueries({ queryKey: ["earnings"] });
        qc.invalidateQueries({ queryKey: ["earnings-lifetime"] });
        qc.invalidateQueries({ queryKey: ["earnings-topsku"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [shopId, qc]);

  // In-range orders
  const ordersQuery = useQuery({
    queryKey: ["earnings", shopId, range.from.toISOString(), range.to.toISOString()],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, order_number, placed_at, status, payment_method, payment_status, subtotal, discount, delivery_fee, fast_delivery_fee, handling_fee, tax, total, address, user_id")
        .eq("shop_id", shopId!)
        .gte("placed_at", range.from.toISOString())
        .lte("placed_at", range.to.toISOString())
        .order("placed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  // Previous-period comparison
  const prevRange = useMemo(() => {
    const span = range.to.getTime() - range.from.getTime();
    return { from: new Date(range.from.getTime() - span - 1), to: new Date(range.from.getTime() - 1) };
  }, [range]);

  const prevQuery = useQuery({
    queryKey: ["earnings-prev", shopId, prevRange.from.toISOString(), prevRange.to.toISOString()],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("total, status")
        .eq("shop_id", shopId!)
        .gte("placed_at", prevRange.from.toISOString())
        .lte("placed_at", prevRange.to.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  // Lifetime + fixed buckets
  const lifetimeQuery = useQuery({
    queryKey: ["earnings-lifetime", shopId],
    enabled: !!shopId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("total, status, placed_at, payment_status")
        .eq("shop_id", shopId!);
      if (error) throw error;
      return (data ?? []) as { total: number; status: string; placed_at: string; payment_status: string }[];
    },
  });

  // Top SKUs in range
  const topSkuQuery = useQuery({
    queryKey: ["earnings-topsku", shopId, range.from.toISOString(), range.to.toISOString()],
    enabled: !!shopId,
    queryFn: async () => {
      const ordIds = (ordersQuery.data ?? []).filter(o => DELIVERED.has(o.status)).map(o => o.id);
      if (ordIds.length === 0) return [];
      const { data, error } = await supabase
        .from("order_items")
        .select("name, quantity, price, order_id")
        .in("order_id", ordIds);
      if (error) throw error;
      const m = new Map<string, { name: string; qty: number; revenue: number }>();
      for (const r of data ?? []) {
        const cur = m.get(r.name) ?? { name: r.name, qty: 0, revenue: 0 };
        cur.qty += Number(r.quantity);
        cur.revenue += Number(r.quantity) * Number(r.price);
        m.set(r.name, cur);
      }
      return Array.from(m.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
    },
  });

  const orders = ordersQuery.data ?? [];

  // ---------- KPIs ----------
  const kpis = useMemo(() => {
    const sumDelivered = (rows: OrderRow[]) => rows.filter(o => DELIVERED.has(o.status)).reduce((s, o) => s + Number(o.total), 0);
    const grossSales = orders.filter(o => DELIVERED.has(o.status)).reduce((s, o) => s + Number(o.subtotal), 0);
    const discounts = orders.filter(o => DELIVERED.has(o.status)).reduce((s, o) => s + Number(o.discount ?? 0), 0);
    const deliveryCharges = orders.filter(o => DELIVERED.has(o.status)).reduce((s, o) => s + Number(o.delivery_fee ?? 0) + Number(o.fast_delivery_fee ?? 0), 0);
    const refundAmt = orders.filter(o => REFUNDED.has(o.payment_status) || REFUNDED.has(o.status)).reduce((s, o) => s + Number(o.total), 0);
    const netRevenue = sumDelivered(orders);
    const estProfit = Math.round(netRevenue * 0.18); // heuristic margin
    const estLoss = Math.round((discounts + refundAmt) * 1);

    const total = orders.length;
    const completed = orders.filter(o => DELIVERED.has(o.status)).length;
    const cancelled = orders.filter(o => CANCELLED.has(o.status)).length;
    const pending = orders.filter(o => !DELIVERED.has(o.status) && !CANCELLED.has(o.status) && !REFUNDED.has(o.status)).length;
    const refunded = orders.filter(o => REFUNDED.has(o.status) || REFUNDED.has(o.payment_status)).length;

    return { netRevenue, grossSales, discounts, deliveryCharges, refundAmt, estProfit, estLoss, total, completed, cancelled, pending, refunded };
  }, [orders]);

  const prevNet = (prevQuery.data ?? []).filter((o: any) => DELIVERED.has(o.status)).reduce((s: number, o: any) => s + Number(o.total), 0);
  const changePct = prevNet === 0 ? (kpis.netRevenue > 0 ? 100 : 0) : Math.round(((kpis.netRevenue - prevNet) / prevNet) * 100);

  // Lifetime / fixed buckets
  const lifetime = useMemo(() => {
    const all = lifetimeQuery.data ?? [];
    const now = new Date();
    const today = startOfDay(now), tEnd = endOfDay(now);
    const yStart = startOfDay(addDays(now,-1)), yEnd = endOfDay(addDays(now,-1));
    const wStart = startOfWeek(now);
    const mStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yrStart = new Date(now.getFullYear(), 0, 1);
    const inRange = (d: string, a: Date, b: Date) => { const t = new Date(d).getTime(); return t >= a.getTime() && t <= b.getTime(); };
    const sum = (fn: (o: any) => boolean) => all.filter(o => DELIVERED.has(o.status) && fn(o)).reduce((s, o) => s + Number(o.total), 0);
    return {
      today: sum(o => inRange(o.placed_at, today, tEnd)),
      yesterday: sum(o => inRange(o.placed_at, yStart, yEnd)),
      week: sum(o => new Date(o.placed_at) >= wStart),
      month: sum(o => new Date(o.placed_at) >= mStart),
      year: sum(o => new Date(o.placed_at) >= yrStart),
      lifetime: all.filter(o => DELIVERED.has(o.status)).reduce((s, o) => s + Number(o.total), 0),
      pendingSettle: all.filter(o => DELIVERED.has(o.status) && o.payment_status !== "paid").reduce((s, o) => s + Number(o.total), 0),
      available: all.filter(o => DELIVERED.has(o.status) && o.payment_status === "paid").reduce((s, o) => s + Number(o.total), 0) * 0.95,
      totalOrders: all.length,
      completed: all.filter(o => DELIVERED.has(o.status)).length,
      cancelled: all.filter(o => CANCELLED.has(o.status)).length,
      refunded: all.filter(o => REFUNDED.has(o.status) || REFUNDED.has(o.payment_status)).length,
    };
  }, [lifetimeQuery.data]);

  // ---------- Chart data ----------
  const chartData = useMemo(() => {
    const spanDays = Math.max(1, Math.ceil((range.to.getTime() - range.from.getTime()) / 86400000));
    const bucket = spanDays <= 1 ? "hour" : spanDays <= 62 ? "day" : "month";
    const map = new Map<string, { label: string; earnings: number; orders: number; profit: number; refunds: number; sortKey: number }>();

    const keyFor = (d: Date) => {
      if (bucket === "hour") return { k: `${d.getHours()}`, label: `${String(d.getHours()).padStart(2,"0")}:00`, sort: d.getHours() };
      if (bucket === "day") return { k: d.toISOString().slice(0,10), label: `${d.getDate()}/${d.getMonth()+1}`, sort: d.getTime() };
      return { k: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en-IN",{month:"short"}), sort: d.getFullYear()*12+d.getMonth() };
    };

    // seed buckets so chart is continuous
    if (bucket === "hour") {
      for (let h = 0; h < 24; h++) map.set(`${h}`, { label: `${String(h).padStart(2,"0")}:00`, earnings: 0, orders: 0, profit: 0, refunds: 0, sortKey: h });
    } else if (bucket === "day") {
      for (let d = new Date(range.from); d <= range.to; d = addDays(d,1)) {
        const k = keyFor(d);
        map.set(k.k, { label: k.label, earnings: 0, orders: 0, profit: 0, refunds: 0, sortKey: k.sort });
      }
    } else {
      for (let m = 0; m < 12; m++) {
        const d = new Date(range.from.getFullYear(), m, 1);
        const k = keyFor(d);
        map.set(k.k, { label: k.label, earnings: 0, orders: 0, profit: 0, refunds: 0, sortKey: k.sort });
      }
    }

    for (const o of orders) {
      const d = new Date(o.placed_at);
      const k = keyFor(d);
      const cur = map.get(k.k) ?? { label: k.label, earnings: 0, orders: 0, profit: 0, refunds: 0, sortKey: k.sort };
      cur.orders += 1;
      if (DELIVERED.has(o.status)) {
        cur.earnings += Number(o.total);
        cur.profit += Number(o.total) * 0.18;
      }
      if (REFUNDED.has(o.status) || REFUNDED.has(o.payment_status)) cur.refunds += Number(o.total);
      map.set(k.k, cur);
    }
    return Array.from(map.values()).sort((a,b) => a.sortKey - b.sortKey);
  }, [orders, range]);

  // ---------- Transactions ----------
  const filteredTxns = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(o =>
      o.order_number.toLowerCase().includes(q) ||
      (o.address?.name ?? "").toLowerCase().includes(q) ||
      o.status.toLowerCase().includes(q) ||
      o.payment_method.toLowerCase().includes(q));
  }, [orders, search]);

  const pageCount = Math.max(1, Math.ceil(filteredTxns.length / PAGE_SIZE));
  const pageRows = filteredTxns.slice((page-1)*PAGE_SIZE, page*PAGE_SIZE);
  useEffect(() => { setPage(1); }, [search, preset, custom.from, custom.to]);

  // ---------- Export ----------
  const downloadFile = (name: string, content: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = name; a.click();
    URL.revokeObjectURL(url);
  };
  const exportCSV = () => {
    const headers = ["Order #","Date","Customer","Payment","Status","Subtotal","Discount","Delivery","Tax","Total"];
    const rows = filteredTxns.map(o => [
      o.order_number, new Date(o.placed_at).toLocaleString(), o.address?.name ?? "",
      o.payment_method, o.status, o.subtotal, o.discount, Number(o.delivery_fee)+Number(o.fast_delivery_fee), o.tax, o.total,
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v ?? "").replace(/"/g,'""')}"`).join(",")).join("\n");
    downloadFile(`earnings_${range.label.toLowerCase().replace(/\s+/g,"_")}.csv`, csv, "text/csv");
  };
  const exportExcel = () => {
    // Simple SpreadsheetML that Excel opens with .xls extension
    const rows = filteredTxns.map(o => `<Row><Cell><Data ss:Type="String">${o.order_number}</Data></Cell><Cell><Data ss:Type="String">${new Date(o.placed_at).toLocaleString()}</Data></Cell><Cell><Data ss:Type="String">${(o.address?.name ?? "").replace(/[<>&]/g,"")}</Data></Cell><Cell><Data ss:Type="String">${o.payment_method}</Data></Cell><Cell><Data ss:Type="String">${o.status}</Data></Cell><Cell><Data ss:Type="Number">${o.total}</Data></Cell></Row>`).join("");
    const xml = `<?xml version="1.0"?><?mso-application progid="Excel.Sheet"?><Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet" xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"><Worksheet ss:Name="Earnings"><Table><Row><Cell><Data ss:Type="String">Order #</Data></Cell><Cell><Data ss:Type="String">Date</Data></Cell><Cell><Data ss:Type="String">Customer</Data></Cell><Cell><Data ss:Type="String">Payment</Data></Cell><Cell><Data ss:Type="String">Status</Data></Cell><Cell><Data ss:Type="String">Total</Data></Cell></Row>${rows}</Table></Worksheet></Workbook>`;
    downloadFile(`earnings_${range.label.toLowerCase().replace(/\s+/g,"_")}.xls`, xml, "application/vnd.ms-excel");
  };
  const exportPDF = () => window.print();

  if (!shopId) {
    return (
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 md:px-6">
        <h1 className="large-title">Earnings</h1>
        <div className="rounded-xl bg-card p-4 border border-border/70">
          <p className="text-body text-muted-foreground">Loading your shop… If this persists, ask an admin to assign one.</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 md:px-6 print:p-0">
        {/* Header + filters */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 print:hidden">
          <div>
            <h1 className="large-title">Earnings</h1>
            <p className="mt-1 text-body text-muted-foreground">Your shop · <span className="font-medium text-foreground">{range.label}</span></p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="secondary" size="sm"><CalendarIcon className="h-4 w-4 mr-2" />{range.label}</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                {PRESETS.map(p => (
                  <DropdownMenuItem key={p.key} onClick={() => setPreset(p.key)}>{p.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {preset === "custom" && (
              <div className="flex items-center gap-1">
                <Input type="date" value={custom.from} onChange={e => setCustom(v => ({ ...v, from: e.target.value }))} className="h-9 w-[140px]" />
                <span className="text-xs text-muted-foreground">→</span>
                <Input type="date" value={custom.to} onChange={e => setCustom(v => ({ ...v, to: e.target.value }))} className="h-9 w-[140px]" />
              </div>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="sm"><Download className="h-4 w-4 mr-2" />Export</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={exportCSV}><FileText className="h-4 w-4 mr-2" />CSV</DropdownMenuItem>
                <DropdownMenuItem onClick={exportExcel}><FileText className="h-4 w-4 mr-2" />Excel</DropdownMenuItem>
                <DropdownMenuItem onClick={exportPDF}><Printer className="h-4 w-4 mr-2" />PDF (print)</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Summary KPIs */}
        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Today" value={rupees(lifetime.today)} icon={<IndianRupee className="h-4 w-4" />} accent="primary" />
          <Kpi label="Yesterday" value={rupees(lifetime.yesterday)} icon={<IndianRupee className="h-4 w-4" />} />
          <Kpi label="This Week" value={rupees(lifetime.week)} icon={<IndianRupee className="h-4 w-4" />} />
          <Kpi label="This Month" value={rupees(lifetime.month)} icon={<IndianRupee className="h-4 w-4" />} />
          <Kpi label="This Year" value={rupees(lifetime.year)} icon={<IndianRupee className="h-4 w-4" />} />
          <Kpi label="Lifetime" value={rupees(lifetime.lifetime)} icon={<Wallet className="h-4 w-4" />} accent="primary" />
          <Kpi label="Pending Settlement" value={rupees(lifetime.pendingSettle)} icon={<Clock className="h-4 w-4" />} />
          <Kpi label="Available Balance" value={rupees(lifetime.available)} icon={<Wallet className="h-4 w-4" />} accent="primary" />
        </section>

        <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi label="Total Orders" value={String(lifetime.totalOrders)} icon={<Package className="h-4 w-4" />} />
          <Kpi label="Completed" value={String(lifetime.completed)} icon={<CheckCircle2 className="h-4 w-4" />} />
          <Kpi label="Cancelled" value={String(lifetime.cancelled)} icon={<XCircle className="h-4 w-4" />} />
          <Kpi label="Refunded" value={String(lifetime.refunded)} icon={<RotateCcw className="h-4 w-4" />} />
        </section>

        {/* Period highlight w/ comparison */}
        <section className="rounded-xl bg-tint-mint p-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="eyebrow">{range.label}</div>
              <div className="mt-1 text-page font-semibold tracking-tight">{rupees(kpis.netRevenue)}</div>
              <div className={`mt-1 inline-flex items-center gap-1 text-meta font-semibold ${changePct >= 0 ? "text-success-foreground" : "text-destructive"}`}>
                {changePct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                {changePct >= 0 ? "+" : ""}{changePct}% vs previous period
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              {(["earnings","orders","profit","refunds"] as const).map(m => (
                <Button key={m} size="sm" variant={chartMetric === m ? "default" : "secondary"} onClick={() => setChartMetric(m)} className="rounded-full capitalize">{m}</Button>
              ))}
            </div>
          </div>
          <div className="mt-4 h-72 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              {chartMetric === "orders" ? (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[6,6,0,0]} />
                </BarChart>
              ) : (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                  <XAxis dataKey="label" fontSize={11} />
                  <YAxis fontSize={11} />
                  <Tooltip formatter={(v: any) => rupees(Number(v))} />
                  <Legend />
                  <Line type="monotone" dataKey={chartMetric} stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>
        </section>

        {/* P&L */}
        <section>
          <h2 className="section-title mb-3">Profit & loss</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Gross Sales" value={rupees(kpis.grossSales)} />
            <Kpi label="Total Discounts" value={rupees(kpis.discounts)} />
            <Kpi label="Delivery Charges" value={rupees(kpis.deliveryCharges)} />
            <Kpi label="Refund Amount" value={rupees(kpis.refundAmt)} />
            <Kpi label="Net Revenue" value={rupees(kpis.netRevenue)} accent="primary" />
            <Kpi label="Estimated Profit" value={rupees(kpis.estProfit)} accent="primary" />
            <Kpi label="Estimated Loss" value={rupees(kpis.estLoss)} />
            <Kpi label="Orders" value={String(kpis.total)} />
          </div>
        </section>

        {/* Order stats */}
        <section>
          <h2 className="section-title mb-3">Orders</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            <Kpi label="Total" value={String(kpis.total)} />
            <Kpi label="Completed" value={String(kpis.completed)} />
            <Kpi label="Pending" value={String(kpis.pending)} />
            <Kpi label="Cancelled" value={String(kpis.cancelled)} />
            <Kpi label="Refunded" value={String(kpis.refunded)} />
          </div>
        </section>

        {/* Top SKUs */}
        <section>
          <h2 className="section-title mb-3">Best sellers</h2>
          <div className="overflow-hidden rounded-xl bg-card border border-border/70">
            <div className="grid grid-cols-12 border-b border-border/60 bg-secondary/50 px-4 py-2.5 text-small font-medium text-muted-foreground">
              <div className="col-span-6">Product</div>
              <div className="col-span-3 text-right">Qty Sold</div>
              <div className="col-span-3 text-right">Revenue</div>
            </div>
            {(topSkuQuery.data ?? []).length === 0 ? (
              <div className="p-8 text-center text-body text-muted-foreground">No sales in this period.</div>
            ) : (topSkuQuery.data ?? []).map(row => (
              <div key={row.name} className="grid min-h-12 grid-cols-12 items-center border-t border-border/60 px-4 py-3 text-body first:border-t-0">
                <div className="col-span-6 truncate font-semibold">{row.name}</div>
                <div className="col-span-3 text-right">{row.qty}</div>
                <div className="col-span-3 text-right font-semibold">{rupees(row.revenue)}</div>
              </div>
            ))}
          </div>
        </section>

        {/* Transactions */}
        <section>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="section-title">Recent transactions</h2>
            <div className="relative w-full max-w-xs">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search order or customer" value={search} onChange={e => setSearch(e.target.value)} className="h-10 pl-10" />
            </div>
          </div>
          <div className="overflow-hidden rounded-xl bg-card border border-border/70">
            <div className="divide-y divide-border/60 md:hidden">
              {pageRows.length === 0 ? (
                <div className="p-4 text-center text-meta text-muted-foreground">No transactions.</div>
              ) : pageRows.map(o => (
                <div key={o.id} className="flex items-start justify-between gap-3 p-3.5">
                  <div className="min-w-0">
                    <div className="text-body font-semibold">{o.order_number}</div>
                    <div className="truncate text-small text-muted-foreground">{o.address?.name ?? "—"} · <span className="uppercase">{o.payment_method}</span></div>
                    <div className="text-caption text-muted-foreground">{new Date(o.placed_at).toLocaleString()}</div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-body font-semibold">{rupees(o.total)}</div>
                    <div className="mt-1"><StatusPill status={o.status} /></div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto md:block">
            <table className="w-full text-body">
              <thead className="bg-secondary/50 text-small font-medium text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Order</th>
                  <th className="px-4 py-2.5 text-left font-medium">Customer</th>
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                  <th className="px-4 py-2.5 text-left font-medium">Payment</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.length === 0 ? (
                  <tr><td colSpan={6} className="p-4 text-center text-muted-foreground">No transactions.</td></tr>
                ) : pageRows.map(o => (
                  <tr key={o.id} className="border-t border-border/60">
                    <td className="px-4 py-3 font-semibold">{o.order_number}</td>
                    <td className="px-4 py-3 truncate max-w-[160px]">{o.address?.name ?? "—"}</td>
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{new Date(o.placed_at).toLocaleString()}</td>
                    <td className="px-4 py-3 uppercase text-xs">{o.payment_method}</td>
                    <td className="px-4 py-3"><StatusPill status={o.status} /></td>
                    <td className="px-4 py-3 text-right font-bold">{rupees(o.total)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            {pageCount > 1 && (
              <div className="flex items-center justify-between border-t border-border/60 px-4 py-3 text-body">
                <div className="text-muted-foreground">Page {page} of {pageCount} · {filteredTxns.length} rows</div>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => setPage(p => p-1)}>Prev</Button>
                  <Button size="sm" variant="outline" disabled={page >= pageCount} onClick={() => setPage(p => p+1)}>Next</Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Settlement */}
        <section>
          <h2 className="section-title mb-3">Settlement</h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Kpi label="Available Balance" value={rupees(lifetime.available)} accent="primary" />
            <Kpi label="Pending Settlement" value={rupees(lifetime.pendingSettle)} />
            <Kpi label="Last Settlement" value="—" hint="No payouts yet" />
            <Kpi label="Next Settlement" value={nextFriday()} hint="Weekly on Friday" />
          </div>
        </section>
      </div>
    </>
  );
}

function nextFriday() {
  const d = new Date();
  const days = (5 - d.getDay() + 7) % 7 || 7;
  const nf = new Date(d); nf.setDate(d.getDate() + days);
  return nf.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function Kpi({ label, value, icon, accent, hint }: { label: string; value: string; icon?: React.ReactNode; accent?: "primary"; hint?: string }) {
  return (
    <div className={`rounded-xl border border-border/70 p-3.5 ${accent === "primary" ? "bg-primary-soft" : "bg-card"}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-small text-muted-foreground">{label}</div>
        {icon && <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${accent === "primary" ? "bg-card/70 text-primary-ink" : "bg-secondary text-muted-foreground"}`}>{icon}</div>}
      </div>
      <div className={`mt-2 text-xl font-semibold tracking-tight ${accent === "primary" ? "text-primary-ink" : ""}`}>{value}</div>
      {hint && <div className="mt-0.5 text-small text-muted-foreground">{hint}</div>}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const cls =
    DELIVERED.has(status) ? "bg-primary-soft text-primary-ink" :
    CANCELLED.has(status) ? "bg-tint-rose text-destructive" :
    REFUNDED.has(status) ? "bg-tint-sun text-warning-foreground" :
    "bg-secondary text-foreground";
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-caption font-semibold capitalize ${cls}`}>{status.replace(/_/g," ")}</span>;
}
