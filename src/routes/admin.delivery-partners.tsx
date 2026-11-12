import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/RoleShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { rupees } from "@/lib/format";
import { Truck, Activity, BarChart3, Circle, Trash2, UserPlus, Radio, Clock } from "lucide-react";
import { partnerStatusMeta, timeAgo } from "@/lib/partnerStatus";


export const Route = createFileRoute("/admin/delivery-partners")({
  head: () => ({ meta: [{ title: "Delivery — AP Mart Admin" }] }),
  component: Page,
});

function Page() {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<any | null>(null);

  const orders = useQuery({
    queryKey: ["admin-active-deliveries"],
    queryFn: async () => {
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, status, address, partner_id, shop_id, placed_at, updated_at")
        .in("status", ["packed", "out_for_delivery"])
        .order("placed_at", { ascending: false })
        .limit(100);
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const partners = useQuery({
    queryKey: ["admin-partners"],
    queryFn: async () => {
      const { data } = await supabase
        .from("delivery_partners")
        .select("id, name, phone, vehicle, is_online, current_lat, current_lng, rating, shop_id, availability_status, active_order_count")
        .order("is_online", { ascending: false });
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const shops = useQuery({
    queryKey: ["admin-shops-list"],
    queryFn: async () => {
      const { data } = await supabase.from("shops").select("id, name").order("name");
      return data ?? [];
    },
  });

  const transferPartner = async (partnerId: string, shopId: string) => {
    const { error } = await supabase.rpc("admin_transfer_partner", { _partner_id: partnerId, _shop_id: shopId });
    if (error) { toast.error(error.message); return; }
    toast.success("Partner transferred");
    qc.invalidateQueries({ queryKey: ["admin-partners"] });
    qc.invalidateQueries({ queryKey: ["admin-perf"] });
  };

  const shopName = (id: string | null) => (shops.data ?? []).find((s: any) => s.id === id)?.name ?? "—";

  const perf = useQuery({
    queryKey: ["admin-perf"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_partner_performance");
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30000,
  });

  const reassign = async (orderId: string, partnerId: string) => {
    const { error } = await supabase.rpc("admin_reassign_partner", { _order_id: orderId, _partner_id: partnerId });
    if (error) toast.error(error.message);
    else { toast.success("Reassigned"); qc.invalidateQueries({ queryKey: ["admin-active-deliveries"] }); }
  };

  const deletePartner = async (id: string) => {
    const { error } = await supabase.rpc("delete_delivery_partner", { _partner_id: id });
    if (error) { toast.error(error.message); return; }
    toast.success("Partner removed");
    setConfirmDel(null);
    qc.invalidateQueries({ queryKey: ["admin-partners"] });
    qc.invalidateQueries({ queryKey: ["admin-perf"] });
  };

  const partnerById = (id: string | null) => (partners.data ?? []).find((p: any) => p.id === id);

  const live = useQuery({
    queryKey: ["admin-live-partners"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("admin_live_partners" as any);
      if (error) throw error;
      return (data ?? []) as Array<{
        partner_id: string; name: string; phone: string | null; vehicle: string | null;
        is_online: boolean; availability_status: string | null; active_order_count: number | null;
        current_order_id: string | null; current_order_number: string | null;
        eta_minutes: number | null; status_updated_at: string | null;
        shop_id: string | null; shop_name: string | null;
      }>;
    },
    refetchInterval: 30000,
  });

  useEffect(() => {
    const ch = supabase
      .channel("admin-live-partners")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_partners" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-live-partners"] });
        qc.invalidateQueries({ queryKey: ["admin-partners"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-active-deliveries"] });
        qc.invalidateQueries({ queryKey: ["admin-live-partners"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const liveByShop = useMemo(() => {
    const groups = new Map<string, { shop_name: string; rows: NonNullable<typeof live.data> }>();
    (live.data ?? []).forEach((r) => {
      const key = r.shop_id ?? "__unassigned__";
      const name = r.shop_name ?? "Unassigned";
      const g = groups.get(key) ?? { shop_name: name, rows: [] as any };
      g.rows.push(r);
      groups.set(key, g);
    });
    return Array.from(groups.entries());
  }, [live.data]);


  return (
    <RoleShell role="admin" nav={ADMIN_NAV} requireRoles={["admin"]}>
      <div className="p-4 md:p-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold flex items-center gap-2">
              <Truck className="h-6 w-6 sm:h-7 sm:w-7 text-primary shrink-0" /> Delivery Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">Add or remove delivery boys, reassign live orders, and monitor performance.</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2 shrink-0 w-full sm:w-auto">
            <Button asChild variant="outline" className="w-full sm:w-auto whitespace-nowrap">
              <Link to="/admin/delivery-pricing"><Truck className="h-4 w-4 mr-1" />Delivery Pricing</Link>
            </Button>
            <Dialog open={addOpen} onOpenChange={setAddOpen}>
              <DialogTrigger asChild>
                <Button className="w-full sm:w-auto shrink-0 whitespace-nowrap"><UserPlus className="h-4 w-4 mr-1" />Add delivery boy</Button>
              </DialogTrigger>
              <AddPartnerDialog shops={shops.data ?? []} onDone={() => { setAddOpen(false); qc.invalidateQueries({ queryKey: ["admin-partners"] }); }} />
            </Dialog>
          </div>
        </header>

        <section className="grid md:grid-cols-3 gap-3">
          <Stat label="Online partners" value={String((partners.data ?? []).filter((p: any) => p.is_online).length)} />
          <Stat label="Active deliveries" value={String((orders.data ?? []).filter((o: any) => o.status === "out_for_delivery").length)} />
          <Stat label="Awaiting pickup" value={String((orders.data ?? []).filter((o: any) => o.status === "packed").length)} />
        </section>

        <section>
          <h2 className="font-bold mb-3 flex items-center gap-2"><Radio className="h-4 w-4 text-primary" />Live partner monitor</h2>
          {liveByShop.length === 0 && (
            <div className="text-sm text-muted-foreground">No delivery partners yet.</div>
          )}
          <div className="space-y-4">
            {liveByShop.map(([shopId, g]) => (
              <div key={shopId} className="rounded-2xl border border-border bg-card">
                <div className="px-4 py-2 border-b border-border bg-secondary/30 font-bold text-sm">{g.shop_name}</div>
                <div className="divide-y divide-border">
                  {g.rows.map((r) => {
                    const m = partnerStatusMeta(r.availability_status, r.is_online);
                    return (
                      <div key={r.partner_id} className="px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
                        <div className="min-w-0">
                          <div className="font-semibold truncate">{r.name}{r.vehicle ? <span className="text-muted-foreground font-normal"> · {r.vehicle}</span> : null}</div>
                          <div className="text-xs text-muted-foreground">{r.phone ?? "—"}</div>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                          <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase font-bold ${m.cls}`}>{m.label}</span>
                          {r.current_order_number && <span>Order <span className="font-bold">{r.current_order_number}</span></span>}
                          {r.eta_minutes != null && <span className="inline-flex items-center gap-1 text-muted-foreground"><Clock className="h-3 w-3" />ETA {r.eta_minutes} min</span>}
                          <span className="text-muted-foreground">Updated {timeAgo(r.status_updated_at)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>



        <section>
          <h2 className="font-bold mb-3 flex items-center gap-2"><Activity className="h-4 w-4 text-primary" />Live orders</h2>
          <div className="space-y-3">
            {(orders.data ?? []).map((o: any) => {
              const p = partnerById(o.partner_id);
              return (
                <div key={o.id} className="rounded-2xl border border-border bg-card p-4 flex flex-wrap items-center gap-3 justify-between">
                  <div className="min-w-0">
                    <div className="font-bold">{o.order_number} <span className="text-muted-foreground font-normal">• {rupees(o.total)}</span></div>
                    <div className="text-xs text-muted-foreground">{o.status.replace(/_/g, " ")} · {(o.address as any)?.line1}, {(o.address as any)?.city}</div>
                    <div className="text-xs mt-1">
                      {p ? (
                        <span className="inline-flex items-center gap-1">
                          <Circle className={`h-2 w-2 ${p.is_online ? "fill-green-500 text-green-500" : "fill-muted text-muted"}`} />
                          <span className="font-semibold">{p.name}</span> · {p.phone ?? "—"}
                        </span>
                      ) : <span className="text-yellow-600 font-semibold">Unassigned</span>}
                    </div>
                  </div>
                  <Select onValueChange={(v) => reassign(o.id, v)}>
                    <SelectTrigger className="w-44 rounded-xl"><SelectValue placeholder={p ? "Reassign" : "Assign partner"} /></SelectTrigger>
                    <SelectContent>
                      {(partners.data ?? []).map((pp: any) => (
                        <SelectItem key={pp.id} value={pp.id}>{pp.name} {pp.is_online ? "🟢" : "⚫"}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              );
            })}
            {(orders.data?.length ?? 0) === 0 && <div className="text-sm text-muted-foreground">No active deliveries.</div>}
          </div>
        </section>

        <section>
          <h2 className="font-bold mb-3 flex items-center gap-2"><BarChart3 className="h-4 w-4 text-primary" />Partner roster &amp; performance</h2>

          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto rounded-2xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase">
                <tr>
                  <th className="text-left px-3 py-2">Partner</th>
                  <th className="text-left px-3 py-2">Phone</th>
                  <th className="text-left px-3 py-2">Shop</th>
                  <th className="text-left px-3 py-2">Status</th>
                  <th className="text-right px-3 py-2">Active</th>
                  <th className="text-right px-3 py-2">Today</th>
                  <th className="text-right px-3 py-2">7d</th>
                  <th className="text-right px-3 py-2">30d</th>
                  <th className="text-right px-3 py-2">Avg min</th>
                  <th className="text-right px-3 py-2">On-time</th>
                  <th className="text-right px-3 py-2">Rating</th>
                  <th className="px-3 py-2">Transfer</th>
                  <th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody>
                {(perf.data ?? []).map((r: any) => {
                  const pp = partnerById(r.partner_id);
                  return (
                    <tr key={r.partner_id} className="border-t border-border">
                      <td className="px-3 py-2 font-semibold">{r.name}</td>
                      <td className="px-3 py-2 text-muted-foreground">{pp?.phone ?? "—"}</td>
                      <td className="px-3 py-2 text-muted-foreground">{shopName(pp?.shop_id ?? null)}</td>
                      <td className="px-3 py-2">{r.is_online ? <span className="text-green-600 font-bold">Online</span> : <span className="text-muted-foreground">Offline</span>}</td>
                      <td className="px-3 py-2 text-right">{pp?.active_order_count ?? 0}</td>
                      <td className="px-3 py-2 text-right">{r.orders_today}</td>
                      <td className="px-3 py-2 text-right">{r.orders_7d}</td>
                      <td className="px-3 py-2 text-right">{r.orders_30d}</td>
                      <td className="px-3 py-2 text-right">{Number(r.avg_minutes_30d).toFixed(1)}</td>
                      <td className="px-3 py-2 text-right">{Number(r.on_time_pct_30d).toFixed(0)}%</td>
                      <td className="px-3 py-2 text-right">{Number(r.rating).toFixed(1)}</td>
                      <td className="px-3 py-2">
                        <Select value={pp?.shop_id ?? ""} onValueChange={(v) => transferPartner(r.partner_id, v)}>
                          <SelectTrigger className="h-8 w-36 rounded-xl"><SelectValue placeholder="Transfer to…" /></SelectTrigger>
                          <SelectContent>
                            {(shops.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button size="icon" variant="ghost" onClick={() => setConfirmDel(r)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
                {(perf.data?.length ?? 0) === 0 && <tr><td colSpan={13} className="px-3 py-6 text-center text-muted-foreground">No data yet.</td></tr>}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {(perf.data ?? []).map((r: any) => {
              const pp = partnerById(r.partner_id);
              return (
                <div key={r.partner_id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-bold truncate">{r.name}</div>
                      <div className="text-xs text-muted-foreground">{pp?.phone ?? "No phone"}</div>
                      <div className="text-xs text-muted-foreground">Shop: {shopName(pp?.shop_id ?? null)}</div>
                      <div className="mt-1 text-xs">
                        {r.is_online
                          ? <span className="inline-flex items-center gap-1 text-green-600 font-bold"><Circle className="h-2 w-2 fill-green-500 text-green-500" />Online</span>
                          : <span className="text-muted-foreground">Offline</span>}
                        <span className="ml-2 rounded-full bg-secondary px-2 py-0.5 text-[10px] uppercase font-bold">{pp?.active_order_count ?? 0} active</span>
                      </div>
                    </div>
                    <Button size="icon" variant="ghost" onClick={() => setConfirmDel(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                    <MiniStat label="Today" value={String(r.orders_today)} />
                    <MiniStat label="7d" value={String(r.orders_7d)} />
                    <MiniStat label="30d" value={String(r.orders_30d)} />
                    <MiniStat label="Avg min" value={Number(r.avg_minutes_30d).toFixed(1)} />
                    <MiniStat label="On-time" value={`${Number(r.on_time_pct_30d).toFixed(0)}%`} />
                    <MiniStat label="Rating" value={Number(r.rating).toFixed(1)} />
                  </div>
                  <div className="mt-3">
                    <Select value={pp?.shop_id ?? ""} onValueChange={(v) => transferPartner(r.partner_id, v)}>
                      <SelectTrigger className="h-9 rounded-xl"><SelectValue placeholder="Transfer to shop…" /></SelectTrigger>
                      <SelectContent>
                        {(shops.data ?? []).map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              );
            })}
            {(perf.data?.length ?? 0) === 0 && <div className="text-sm text-muted-foreground text-center py-6">No data yet.</div>}
          </div>
        </section>

        <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove “{confirmDel?.name}”?</AlertDialogTitle>
              <AlertDialogDescription>The partner profile and delivery role will be removed. Active orders block deletion.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmDel && deletePartner(confirmDel.partner_id)}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RoleShell>
  );
}

function AddPartnerDialog({ onDone }: { shops: Array<{ id: string; name: string }>; onDone: () => void }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [vehicle, setVehicle] = useState("");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!name.trim()) { toast.error("Name required"); return; }
    setBusy(true);
    const { error } = await supabase.rpc("admin_create_delivery_partner", {
      _name: name.trim(),
      _phone: phone.trim(),
      _vehicle: vehicle.trim() || undefined,
      _user_email: email.trim() || undefined,
    } as any);
    setBusy(false);
    if (error) toast.error(error.message);
    else { toast.success("Partner added to pool"); onDone(); }
  };

  return (
    <DialogContent>
      <DialogHeader><DialogTitle>Create delivery partner</DialogTitle></DialogHeader>
      <p className="text-xs text-muted-foreground -mt-1">Partners you create here go into the pool. Shopkeepers then select their team.</p>
      <div className="space-y-3">
        <div><label className="text-xs font-bold">Name *</label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><label className="text-xs font-bold">Phone</label><Input value={phone} onChange={(e) => setPhone(e.target.value)} /></div>
        <div><label className="text-xs font-bold">Vehicle type</label><Input value={vehicle} onChange={(e) => setVehicle(e.target.value)} placeholder="Bike / Scooter / EV" /></div>
        <div>
          <label className="text-xs font-bold">Account email (optional)</label>
          <Input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="User must already be signed up" />
          <p className="text-[11px] text-muted-foreground mt-1">Linked email gains the delivery role automatically.</p>
        </div>
      </div>
      <DialogFooter>
        <Button onClick={submit} disabled={busy}>{busy ? "Adding…" : "Add partner"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}


function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <div className="text-xs text-muted-foreground font-semibold">{label}</div>
      <div className="font-display text-2xl font-extrabold mt-1">{value}</div>
    </div>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary/40 px-2 py-1.5">
      <div className="text-[10px] uppercase font-bold text-muted-foreground">{label}</div>
      <div className="font-bold text-sm">{value}</div>
    </div>
  );
}
