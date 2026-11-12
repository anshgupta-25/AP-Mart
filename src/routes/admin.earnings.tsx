import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar, PieChart, Pie, Cell, Legend,
} from "recharts";
import { Download, Search, ArrowUpDown, TrendingUp, TrendingDown } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/RoleShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { rupees } from "@/lib/format";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/admin/earnings")({
  head: () => ({ meta: [{ title: "Earnings & Analytics — Admin" }] }),
  component: Page,
});

// ---------- date helpers ----------
type PresetKey = "today" | "yesterday" | "this_week" | "last_week" | "this_month" | "last_month" | "this_year" | "custom";

function startOfDay(d: Date) { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
function endOfDay(d: Date) { const x = new Date(d); x.setHours(23, 59, 59, 999); return x; }
function addDays(d: Date, n: number) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
function startOfWeek(d: Date) { const x = startOfDay(d); const day = (x.getDay() + 6) % 7; return addDays(x, -day); } // Mon start

function presetRange(k: PresetKey, custom?: { from: string; to: string }): { from: Date; to: Date; label: string } {
  const now = new Date();
  switch (k) {
    case "today": return { from: startOfDay(now), to: endOfDay(now), label: "Today" };
    case "yesterday": { const y = addDays(now, -1); return { from: startOfDay(y), to: endOfDay(y), label: "Yesterday" }; }
    case "this_week": return { from: startOfWeek(now), to: endOfDay(now), label: "This Week" };
    case "last_week": { const s = addDays(startOfWeek(now), -7); return { from: s, to: endOfDay(addDays(s, 6)), label: "Last Week" }; }
    case "this_month": return { from: startOfDay(new Date(now.getFullYear(), now.getMonth(), 1)), to: endOfDay(now), label: "This Month" };
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { from: startOfDay(s), to: endOfDay(e), label: "Last Month" };
    }
    case "this_year": return { from: startOfDay(new Date(now.getFullYear(), 0, 1)), to: endOfDay(now), label: "This Year" };
    case "custom": {
      const f = custom?.from ? new Date(custom.from) : startOfDay(now);
      const t = custom?.to ? new Date(custom.to) : endOfDay(now);
      return { from: startOfDay(f), to: endOfDay(t), label: "Custom" };
    }
  }
}

const PRESETS: { key: PresetKey; label: string }[] = [
  { key: "today", label: "Today" }, { key: "yesterday", label: "Yesterday" },
  { key: "this_week", label: "This Week" }, { key: "last_week", label: "Last Week" },
  { key: "this_month", label: "This Month" }, { key: "last_month", label: "Last Month" },
  { key: "this_year", label: "This Year" }, { key: "custom", label: "Custom" },
];

// ---------- types ----------
type OrderRow = {
  id: string; order_number: string; status: string; payment_status: string;
  subtotal: number; discount: number; tax: number; delivery_fee: number;
  handling_fee: number; fast_delivery_fee: number; total: number;
  placed_at: string; shop_id: string | null; user_id: string;
  delivery_pincode: string | null;
};
type ShopRow = { id: string; name: string; owner_id: string | null; city: string; pincode: string; is_open: boolean; created_at: string; address: string; phone: string | null };

const COMPLETED = new Set(["delivered"]);
const CANCELLED_SET = new Set(["cancelled"]);
const PENDING_SET = new Set(["placed", "payment_confirmed", "awaiting_shop", "accepted_by_shop", "packing", "packed", "out_for_delivery"]);
const RETURNED_SET = new Set<string>([]); // no explicit status; keep zero unless added later

function Page() {
  const [preset, setPreset] = useState<PresetKey>("this_month");
  const [custom, setCustom] = useState({ from: "", to: "" });
  const range = useMemo(() => presetRange(preset, custom), [preset, custom]);

  const [commission, setCommission] = useState(0.1);
  useEffect(() => {
    supabase.from("app_config").select("value").eq("key", "platform_commission_pct").maybeSingle()
      .then(({ data }) => { const v = Number(data?.value); if (!Number.isNaN(v) && v > 0) setCommission(v > 1 ? v / 100 : v); });
  }, []);

  const ordersQ = useQuery({
    queryKey: ["admin-earn-orders", range.from.toISOString(), range.to.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.from("orders")
        .select("id,order_number,status,payment_status,subtotal,discount,tax,delivery_fee,handling_fee,fast_delivery_fee,total,placed_at,shop_id,user_id,delivery_pincode")
        .gte("placed_at", range.from.toISOString())
        .lte("placed_at", range.to.toISOString())
        .order("placed_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as OrderRow[];
    },
  });

  const shopsQ = useQuery({
    queryKey: ["admin-earn-shops"],
    queryFn: async () => {
      const { data, error } = await supabase.from("shops").select("id,name,owner_id,city,pincode,is_open,created_at,address,phone");
      if (error) throw error;
      return (data ?? []) as ShopRow[];
    },
  });

  const ownersQ = useQuery({
    queryKey: ["admin-earn-owners", shopsQ.data?.map(s => s.owner_id).sort().join(",")],
    enabled: !!shopsQ.data?.length,
    queryFn: async () => {
      const ids = Array.from(new Set((shopsQ.data ?? []).map(s => s.owner_id).filter(Boolean))) as string[];
      if (!ids.length) return new Map<string, { full_name: string | null; phone: string | null }>();
      const { data } = await supabase.from("profiles").select("id,full_name,phone").in("id", ids);
      const m = new Map<string, { full_name: string | null; phone: string | null }>();
      (data ?? []).forEach((p: any) => m.set(p.id, { full_name: p.full_name, phone: p.phone }));
      return m;
    },
  });

  const orders = ordersQ.data ?? [];
  const shops = shopsQ.data ?? [];
  const owners = ownersQ.data ?? new Map();

  // ---------- KPI aggregation ----------
  const stats = useMemo(() => {
    let grossRevenue = 0, completedGross = 0, deliveryCharges = 0, discounts = 0, taxes = 0, refunds = 0;
    let completed = 0, cancelled = 0, pending = 0, returned = 0;
    const customers = new Set<string>();
    for (const o of orders) {
      grossRevenue += Number(o.total ?? 0);
      deliveryCharges += Number(o.delivery_fee ?? 0) + Number(o.fast_delivery_fee ?? 0);
      discounts += Number(o.discount ?? 0);
      taxes += Number(o.tax ?? 0);
      customers.add(o.user_id);
      if (COMPLETED.has(o.status)) { completed++; completedGross += Number(o.total ?? 0); }
      else if (CANCELLED_SET.has(o.status)) { cancelled++; if (o.payment_status === "refunded" || o.payment_status === "refund_initiated") refunds += Number(o.total ?? 0); }
      else if (PENDING_SET.has(o.status)) pending++;
      if (RETURNED_SET.has(o.status)) returned++;
    }
    const platformCommission = completedGross * commission;
    const shopEarnings = completedGross - platformCommission - refunds;
    const netRevenue = platformCommission + deliveryCharges;
    const activeShops = shops.filter(s => s.is_open).length;
    const aov = orders.length ? grossRevenue / orders.length : 0;
    return {
      grossRevenue, shopEarnings, totalOrders: orders.length, completed, pending, cancelled, returned,
      activeShops, aov, customers: customers.size, deliveryCharges, platformCommission, refunds, netRevenue,
    };
  }, [orders, shops, commission]);

  // ---------- time series ----------
  const timeSeries = useMemo(() => {
    const map = new Map<string, { day: string; orders: number; revenue: number; earnings: number }>();
    for (const o of orders) {
      const day = new Date(o.placed_at).toISOString().slice(0, 10);
      const cur = map.get(day) ?? { day, orders: 0, revenue: 0, earnings: 0 };
      cur.orders += 1;
      cur.revenue += Number(o.total ?? 0);
      if (COMPLETED.has(o.status)) cur.earnings += Number(o.total ?? 0) * (1 - commission);
      map.set(day, cur);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [orders, commission]);

  const statusDist = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of orders) m[o.status] = (m[o.status] ?? 0) + 1;
    return Object.entries(m).map(([name, value]) => ({ name, value }));
  }, [orders]);

  // ---------- shop performance ----------
  type ShopStat = {
    shop_id: string; name: string; owner: string; city: string; pincode: string; status: string;
    ordersTotal: number; ordersToday: number; ordersWeek: number; ordersMonth: number;
    completed: number; pending: number; cancelled: number; returned: number;
    grossRevenue: number; shopEarnings: number; platformCommission: number;
    aov: number; lastOrderAt: string | null;
  };
  const shopStats: ShopStat[] = useMemo(() => {
    const now = new Date();
    const todayStart = startOfDay(now).getTime();
    const weekStart = startOfWeek(now).getTime();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
    const perShop = new Map<string, ShopStat>();
    for (const s of shops) {
      perShop.set(s.id, {
        shop_id: s.id, name: s.name, owner: owners.get(s.owner_id ?? "")?.full_name ?? (s.owner_id ? "—" : "Unassigned"),
        city: s.city, pincode: s.pincode, status: s.is_open ? "Open" : "Closed",
        ordersTotal: 0, ordersToday: 0, ordersWeek: 0, ordersMonth: 0,
        completed: 0, pending: 0, cancelled: 0, returned: 0,
        grossRevenue: 0, shopEarnings: 0, platformCommission: 0, aov: 0, lastOrderAt: null,
      });
    }
    for (const o of orders) {
      if (!o.shop_id) continue;
      const s = perShop.get(o.shop_id); if (!s) continue;
      s.ordersTotal++;
      const t = new Date(o.placed_at).getTime();
      if (t >= todayStart) s.ordersToday++;
      if (t >= weekStart) s.ordersWeek++;
      if (t >= monthStart) s.ordersMonth++;
      if (COMPLETED.has(o.status)) { s.completed++; s.grossRevenue += Number(o.total ?? 0); }
      else if (CANCELLED_SET.has(o.status)) s.cancelled++;
      else if (PENDING_SET.has(o.status)) s.pending++;
      if (RETURNED_SET.has(o.status)) s.returned++;
      if (!s.lastOrderAt || t > new Date(s.lastOrderAt).getTime()) s.lastOrderAt = o.placed_at;
    }
    for (const s of perShop.values()) {
      s.platformCommission = s.grossRevenue * commission;
      s.shopEarnings = s.grossRevenue - s.platformCommission;
      s.aov = s.completed ? s.grossRevenue / s.completed : 0;
    }
    return Array.from(perShop.values());
  }, [shops, orders, owners, commission]);

  // ---------- top / bottom leaderboards ----------
  const topByRevenue = [...shopStats].sort((a, b) => b.grossRevenue - a.grossRevenue).slice(0, 10);
  const topByOrders = [...shopStats].sort((a, b) => b.ordersTotal - a.ordersTotal).slice(0, 10);
  const worstByRevenue = [...shopStats].filter(s => s.ordersTotal > 0).sort((a, b) => a.grossRevenue - b.grossRevenue).slice(0, 5);
  const mostCancellations = [...shopStats].sort((a, b) => b.cancelled - a.cancelled).slice(0, 5);

  // ---------- table controls ----------
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<keyof ShopStat>("grossRevenue");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [page, setPage] = useState(1);
  const perPage = 15;
  const filteredShops = useMemo(() => {
    const needle = q.trim().toLowerCase();
    let list = shopStats;
    if (needle) list = list.filter(s => s.name.toLowerCase().includes(needle) || s.owner.toLowerCase().includes(needle) || s.city.toLowerCase().includes(needle) || s.pincode.includes(needle));
    list = [...list].sort((a, b) => {
      const av = a[sortBy] as any, bv = b[sortBy] as any;
      if (av == null) return 1; if (bv == null) return -1;
      const cmp = typeof av === "number" ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [shopStats, q, sortBy, sortDir]);
  const totalPages = Math.max(1, Math.ceil(filteredShops.length / perPage));
  const pageRows = filteredShops.slice((page - 1) * perPage, page * perPage);
  useEffect(() => { setPage(1); }, [q, preset]);

  const [drawerShop, setDrawerShop] = useState<ShopStat | null>(null);

  const toggleSort = (col: keyof ShopStat) => {
    if (sortBy === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortBy(col); setSortDir("desc"); }
  };

  const exportCsv = () => {
    const cols = ["Shop", "Owner", "Pincode", "City", "Status", "Orders (Total)", "Today", "This Week", "This Month", "Completed", "Pending", "Cancelled", "Gross Revenue", "Shop Earnings", "Platform Commission", "AOV", "Last Order"];
    const lines = [cols.join(",")];
    for (const s of filteredShops) {
      const row = [s.name, s.owner, s.pincode, s.city, s.status, s.ordersTotal, s.ordersToday, s.ordersWeek, s.ordersMonth, s.completed, s.pending, s.cancelled, s.grossRevenue.toFixed(2), s.shopEarnings.toFixed(2), s.platformCommission.toFixed(2), s.aov.toFixed(2), s.lastOrderAt ?? ""].map(v => `"${String(v).replace(/"/g, '""')}"`);
      lines.push(row.join(","));
    }
    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `shop-performance-${range.label.replace(/\s+/g, "_").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const loading = ordersQ.isLoading || shopsQ.isLoading;

  return (
    <RoleShell role="admin" nav={ADMIN_NAV} requireRoles={["admin"]}>
      <div className="p-4 md:p-6 space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-3xl font-extrabold">Earnings & Analytics</h1>
            <p className="text-sm text-muted-foreground mt-1">Platform revenue, shop performance, and operational insight for <b>{range.label}</b></p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="rounded-xl">{PRESETS.find(p => p.key === preset)?.label} ▾</Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {PRESETS.map(p => (
                  <DropdownMenuItem key={p.key} onClick={() => setPreset(p.key)}>{p.label}</DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {preset === "custom" && (
              <div className="flex items-center gap-1">
                <Input type="date" value={custom.from} onChange={(e) => setCustom(c => ({ ...c, from: e.target.value }))} className="w-[150px]" />
                <span className="text-muted-foreground">→</span>
                <Input type="date" value={custom.to} onChange={(e) => setCustom(c => ({ ...c, to: e.target.value }))} className="w-[150px]" />
              </div>
            )}
            <Button variant="default" className="rounded-xl gap-2" onClick={exportCsv}><Download className="h-4 w-4" />Export CSV</Button>
          </div>
        </header>

        {/* KPI cards */}
        <section className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3">
          <Kpi label="Total Platform Revenue" value={rupees(stats.grossRevenue)} accent />
          <Kpi label="Shop Earnings" value={rupees(stats.shopEarnings)} />
          <Kpi label="Platform Commission" value={rupees(stats.platformCommission)} />
          <Kpi label="Net Revenue" value={rupees(stats.netRevenue)} />
          <Kpi label="Delivery Charges" value={rupees(stats.deliveryCharges)} />
          <Kpi label="Refunds" value={rupees(stats.refunds)} />
          <Kpi label="Avg Order Value" value={rupees(Math.round(stats.aov))} />
          <Kpi label="Total Orders" value={String(stats.totalOrders)} />
          <Kpi label="Completed" value={String(stats.completed)} tone="success" />
          <Kpi label="Pending" value={String(stats.pending)} tone="warn" />
          <Kpi label="Cancelled" value={String(stats.cancelled)} tone="danger" />
          <Kpi label="Returned" value={String(stats.returned)} />
          <Kpi label="Active Shops" value={String(stats.activeShops)} />
          <Kpi label="Customers" value={String(stats.customers)} />
        </section>

        {/* Charts */}
        <section className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <ChartCard title="Revenue & Orders Trend" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="l" tick={{ fontSize: 11 }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                <Line yAxisId="l" type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" strokeWidth={2} name="Revenue" dot={false} />
                <Line yAxisId="r" type="monotone" dataKey="orders" stroke="#f59e0b" strokeWidth={2} name="Orders" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Order Status Distribution">
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie data={statusDist} dataKey="value" nameKey="name" outerRadius={90} label>
                  {statusDist.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Top 10 Shops by Revenue" className="lg:col-span-2">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topByRevenue.map(s => ({ name: s.name, revenue: Math.round(s.grossRevenue) }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Top 10 Shops by Orders">
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={topByOrders.map(s => ({ name: s.name, orders: s.ordersTotal }))}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.2} />
                <XAxis dataKey="name" tick={{ fontSize: 10 }} interval={0} angle={-15} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="orders" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </section>

        {/* Analytics highlights */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          <Highlight icon={<TrendingUp className="text-emerald-500" />} title="Highest Revenue Shop" value={topByRevenue[0]?.name ?? "—"} sub={rupees(topByRevenue[0]?.grossRevenue ?? 0)} />
          <Highlight icon={<TrendingDown className="text-rose-500" />} title="Lowest Revenue (active)" value={worstByRevenue[0]?.name ?? "—"} sub={rupees(worstByRevenue[0]?.grossRevenue ?? 0)} />
          <Highlight icon={<TrendingUp className="text-emerald-500" />} title="Most Orders" value={topByOrders[0]?.name ?? "—"} sub={`${topByOrders[0]?.ordersTotal ?? 0} orders`} />
          <Highlight icon={<TrendingDown className="text-rose-500" />} title="Most Cancellations" value={mostCancellations[0]?.name ?? "—"} sub={`${mostCancellations[0]?.cancelled ?? 0} cancelled`} />
        </section>

        {/* Shop performance table */}
        <section className="rounded-2xl border border-border bg-card">
          <div className="p-4 flex flex-wrap items-center gap-2 justify-between border-b border-border">
            <h2 className="font-bold text-lg">Shop Performance</h2>
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search shop, owner, pincode..." className="pl-9 w-[260px]" />
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase font-bold">
                <tr>
                  {[
                    ["name", "Shop"], ["owner", "Owner"], ["pincode", "Pincode"], ["city", "City"], ["status", "Status"],
                    ["ordersToday", "Today"], ["ordersWeek", "Week"], ["ordersMonth", "Month"], ["ordersTotal", "Total"],
                    ["completed", "✓"], ["pending", "…"], ["cancelled", "✗"],
                    ["grossRevenue", "Gross"], ["shopEarnings", "Earnings"], ["platformCommission", "Commission"],
                    ["aov", "AOV"], ["lastOrderAt", "Last Order"],
                  ].map(([k, label]) => (
                    <th key={k} className="px-3 py-2 text-left whitespace-nowrap">
                      <button className="inline-flex items-center gap-1 hover:text-primary" onClick={() => toggleSort(k as keyof ShopStat)}>
                        {label}<ArrowUpDown className="h-3 w-3 opacity-50" />
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loading && <tr><td colSpan={17} className="p-6 text-center text-muted-foreground">Loading…</td></tr>}
                {!loading && pageRows.length === 0 && <tr><td colSpan={17} className="p-6 text-center text-muted-foreground">No shops match your filter.</td></tr>}
                {pageRows.map(s => (
                  <tr key={s.shop_id} className="border-t border-border hover:bg-secondary/40 cursor-pointer" onClick={() => setDrawerShop(s)}>
                    <td className="px-3 py-2 font-semibold">{s.name}</td>
                    <td className="px-3 py-2">{s.owner}</td>
                    <td className="px-3 py-2">{s.pincode}</td>
                    <td className="px-3 py-2">{s.city}</td>
                    <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${s.status === "Open" ? "bg-emerald-500/15 text-emerald-600" : "bg-muted text-muted-foreground"}`}>{s.status}</span></td>
                    <td className="px-3 py-2">{s.ordersToday}</td>
                    <td className="px-3 py-2">{s.ordersWeek}</td>
                    <td className="px-3 py-2">{s.ordersMonth}</td>
                    <td className="px-3 py-2 font-semibold">{s.ordersTotal}</td>
                    <td className="px-3 py-2 text-emerald-600">{s.completed}</td>
                    <td className="px-3 py-2 text-amber-600">{s.pending}</td>
                    <td className="px-3 py-2 text-rose-600">{s.cancelled}</td>
                    <td className="px-3 py-2 font-bold">{rupees(s.grossRevenue)}</td>
                    <td className="px-3 py-2">{rupees(s.shopEarnings)}</td>
                    <td className="px-3 py-2">{rupees(s.platformCommission)}</td>
                    <td className="px-3 py-2">{rupees(Math.round(s.aov))}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground whitespace-nowrap">{s.lastOrderAt ? new Date(s.lastOrderAt).toLocaleString() : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="p-3 flex items-center justify-between text-xs text-muted-foreground border-t border-border">
            <span>{filteredShops.length} shops</span>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Prev</Button>
              <span className="px-2">Page {page} / {totalPages}</span>
              <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          </div>
        </section>
      </div>

      <ShopDetailDialog shop={drawerShop} onClose={() => setDrawerShop(null)} orders={orders} shops={shops} owners={owners} commission={commission} />
    </RoleShell>
  );
}

const PIE_COLORS = ["#84cc16", "#f59e0b", "#f43f5e", "#3b82f6", "#a855f7", "#10b981", "#eab308", "#ec4899", "#22d3ee", "#64748b"];

function Kpi({ label, value, accent, tone }: { label: string; value: string; accent?: boolean; tone?: "success" | "warn" | "danger" }) {
  const toneCls = tone === "success" ? "text-emerald-600" : tone === "warn" ? "text-amber-600" : tone === "danger" ? "text-rose-600" : "";
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 ${accent ? "gradient-primary text-primary-foreground border-transparent" : ""}`}>
      <div className={`text-[11px] font-bold uppercase tracking-wide ${accent ? "opacity-90" : "text-muted-foreground"}`}>{label}</div>
      <div className={`font-display text-xl font-extrabold mt-1 ${toneCls}`}>{value}</div>
    </div>
  );
}

function Highlight({ icon, title, value, sub }: { icon: React.ReactNode; title: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4 flex items-center gap-3">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-secondary">{icon}</div>
      <div className="min-w-0">
        <div className="text-[11px] uppercase font-bold text-muted-foreground">{title}</div>
        <div className="font-bold truncate">{value}</div>
        <div className="text-xs text-muted-foreground">{sub}</div>
      </div>
    </div>
  );
}

function ChartCard({ title, className = "", children }: { title: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-border bg-card p-4 ${className}`}>
      <h3 className="font-bold mb-3">{title}</h3>
      {children}
    </div>
  );
}

function ShopDetailDialog({
  shop, onClose, orders, shops, owners, commission,
}: {
  shop: any; onClose: () => void; orders: OrderRow[]; shops: ShopRow[]; owners: Map<string, any>; commission: number;
}) {
  const detail = useMemo(() => {
    if (!shop) return null;
    const s = shops.find(x => x.id === shop.shop_id);
    const shopOrders = orders.filter(o => o.shop_id === shop.shop_id);
    let gross = 0, delivery = 0, discounts = 0, taxes = 0, refunds = 0, completedGross = 0;
    let completed = 0, pending = 0, cancelled = 0, returned = 0;
    const customers = new Set<string>();
    const productMap = new Map<string, number>();
    let fastest = Infinity, avgTime = 0, times: number[] = [];
    for (const o of shopOrders) {
      gross += Number(o.total ?? 0);
      delivery += Number(o.delivery_fee ?? 0) + Number(o.fast_delivery_fee ?? 0);
      discounts += Number(o.discount ?? 0);
      taxes += Number(o.tax ?? 0);
      customers.add(o.user_id);
      if (COMPLETED.has(o.status)) { completed++; completedGross += Number(o.total ?? 0); }
      else if (CANCELLED_SET.has(o.status)) { cancelled++; if (o.payment_status === "refunded" || o.payment_status === "refund_initiated") refunds += Number(o.total ?? 0); }
      else if (PENDING_SET.has(o.status)) pending++;
    }
    const platformCommission = completedGross * commission;
    const shopEarnings = completedGross - platformCommission - refunds;
    const netRevenue = platformCommission + delivery;
    return {
      s, shopOrders, gross, delivery, discounts, taxes, refunds,
      completed, pending, cancelled, returned,
      platformCommission, shopEarnings, netRevenue,
      customers: customers.size,
      owner: s?.owner_id ? owners.get(s.owner_id) : null,
    };
  }, [shop, orders, shops, owners, commission]);

  if (!shop || !detail) return null;
  const { s, owner } = detail;
  return (
    <Dialog open={!!shop} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl">{shop.name}</DialogTitle>
        </DialogHeader>
        <div className="space-y-5">
          <Section title="Shop Information">
            <Grid>
              <KV k="Owner" v={owner?.full_name ?? "Unassigned"} />
              <KV k="Phone" v={owner?.phone ?? s?.phone ?? "—"} />
              <KV k="Pincode" v={shop.pincode} />
              <KV k="City" v={shop.city} />
              <KV k="Address" v={s?.address ?? "—"} />
              <KV k="Registered" v={s?.created_at ? new Date(s.created_at).toLocaleDateString() : "—"} />
              <KV k="Status" v={shop.status} />
            </Grid>
          </Section>

          <Section title="Earnings (period)">
            <Grid>
              <KV k="Gross Sales" v={rupees(detail.gross)} />
              <KV k="Delivery Charges" v={rupees(detail.delivery)} />
              <KV k="Discounts" v={rupees(detail.discounts)} />
              <KV k="Taxes" v={rupees(detail.taxes)} />
              <KV k="Refunds" v={rupees(detail.refunds)} />
              <KV k="Platform Commission" v={rupees(detail.platformCommission)} />
              <KV k="Shop Earnings" v={rupees(detail.shopEarnings)} strong />
              <KV k="Net Revenue (platform)" v={rupees(detail.netRevenue)} />
            </Grid>
          </Section>

          <Section title="Orders">
            <Grid>
              <KV k="Today" v={String(shop.ordersToday)} />
              <KV k="This Week" v={String(shop.ordersWeek)} />
              <KV k="This Month" v={String(shop.ordersMonth)} />
              <KV k="In Range" v={String(shop.ordersTotal)} />
              <KV k="Completed" v={String(detail.completed)} />
              <KV k="Pending" v={String(detail.pending)} />
              <KV k="Cancelled" v={String(detail.cancelled)} />
              <KV k="Returned" v={String(detail.returned)} />
            </Grid>
          </Section>

          <Section title="Customer Analytics">
            <Grid>
              <KV k="Unique Customers" v={String(detail.customers)} />
              <KV k="Avg Order Value" v={rupees(Math.round(shop.aov))} />
            </Grid>
          </Section>

          <div className="text-xs text-muted-foreground">
            Product & delivery analytics use live order data; extend with `order_items` and delivery timing queries as your dataset grows.
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="font-bold text-sm uppercase tracking-wide text-muted-foreground mb-2">{title}</h3>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{children}</div>;
}
function KV({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <div className="rounded-xl bg-secondary/40 p-3">
      <div className="text-[10px] font-bold uppercase text-muted-foreground">{k}</div>
      <div className={`mt-1 ${strong ? "text-primary font-extrabold" : "font-semibold"}`}>{v}</div>
    </div>
  );
}
