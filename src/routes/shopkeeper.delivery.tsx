import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { rupees } from "@/lib/format";
import { Truck, Activity, BarChart3, Users, Star, UserCog, X, Clock } from "lucide-react";
import { partnerStatusMeta, timeAgo } from "@/lib/partnerStatus";

export const Route = createFileRoute("/shopkeeper/delivery")({
  head: () => ({ meta: [{ title: "Delivery — AP Mart" }] }),
  component: Page,
});

type TeamPartner = {
  partner_id: string;
  name: string;
  phone: string | null;
  vehicle: string | null;
  is_online: boolean;
  rating: number | null;
  availability_status: string | null;
  active_order_count: number | null;
  current_order_id?: string | null;
  current_order_number?: string | null;
  eta_minutes?: number | null;
  status_updated_at?: string | null;
};

type AvailablePartner = {
  partner_id: string;
  name: string;
  phone: string | null;
  vehicle: string | null;
  is_online: boolean;
  rating: number | null;
  on_team: boolean;
};

function badgeFor(p: { is_online?: boolean; availability_status?: string | null }) {
  return partnerStatusMeta(p.availability_status, p.is_online);
}


function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [shopId, setShopId] = useState<string | null>(null);
  const [teamOpen, setTeamOpen] = useState(false);
  const [assignFor, setAssignFor] = useState<any | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("shops").select("id").eq("owner_id", user.id).maybeSingle()
      .then(({ data }) => setShopId(data?.id ?? null));
  }, [user]);

  const orders = useQuery({
    queryKey: ["shop-delivery-orders", shopId],
    queryFn: async () => {
      if (!shopId) return [];
      const { data } = await supabase
        .from("orders")
        .select("id, order_number, total, status, address, partner_id, placed_at")
        .eq("shop_id", shopId)
        .in("status", ["packed", "out_for_delivery"])
        .order("placed_at", { ascending: false });
      return data ?? [];
    },
    enabled: !!shopId,
    refetchInterval: 30000,
  });

  const team = useQuery({
    queryKey: ["shop-team", shopId],
    queryFn: async () => {
      if (!shopId) return [] as TeamPartner[];
      const { data, error } = await supabase.rpc("shop_live_team" as any, { _shop_id: shopId });
      if (error) throw error;
      return (data ?? []) as TeamPartner[];
    },
    enabled: !!shopId,
    refetchInterval: 30000,
  });

  // Realtime updates: any change to a delivery partner or to our shop's orders refreshes the view
  useEffect(() => {
    if (!shopId) return;
    const ch = supabase
      .channel(`shop-live-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_partners" }, () => {
        qc.invalidateQueries({ queryKey: ["shop-team", shopId] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `shop_id=eq.${shopId}` }, () => {
        qc.invalidateQueries({ queryKey: ["shop-delivery-orders", shopId] });
        qc.invalidateQueries({ queryKey: ["shop-team", shopId] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [shopId, qc]);


  const perf = useQuery({
    queryKey: ["shop-perf", shopId],
    queryFn: async () => {
      if (!shopId) return [];
      const { data, error } = await supabase.rpc("shop_partner_performance", { _shop_id: shopId });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!shopId,
    refetchInterval: 30000,
  });

  const perfByPartner = useMemo(() => {
    const m: Record<string, any> = {};
    (perf.data ?? []).forEach((r: any) => { m[r.partner_id] = r; });
    return m;
  }, [perf.data]);

  const teamById = (id: string | null) => (team.data ?? []).find((p) => p.partner_id === id);

  const assign = async (orderId: string, partnerId: string) => {
    const { error } = await supabase.rpc("shop_assign_partner", { _order_id: orderId, _partner_id: partnerId });
    if (error) { toast.error(error.message); return; }
    toast.success("Order assigned");
    setAssignFor(null);
    qc.invalidateQueries({ queryKey: ["shop-delivery-orders", shopId] });
    qc.invalidateQueries({ queryKey: ["shop-team", shopId] });
  };

  const removePartner = async (partnerId: string) => {
    if (!shopId) return;
    const currentIds = (team.data ?? []).map((p) => p.partner_id).filter((id) => id !== partnerId);
    const { error } = await supabase.rpc("shop_set_team", { _shop_id: shopId, _partner_ids: currentIds });
    if (error) { toast.error(error.message); return; }
    toast.success("Partner removed from shop");
    qc.invalidateQueries({ queryKey: ["shop-team", shopId] });
    qc.invalidateQueries({ queryKey: ["shop-perf", shopId] });
  };

  return (
    <>
      <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 md:px-6">
        <header className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <div className="flex-1 min-w-0">
            <h1 className="large-title">Delivery</h1>
            <p className="mt-1 text-body text-muted-foreground">
              Build your delivery team and assign orders to them.
            </p>
          </div>
          <Button className="w-full shrink-0 whitespace-nowrap sm:w-auto" onClick={() => setTeamOpen(true)}>
            <UserCog className="mr-1.5 h-4 w-4" />Select team
          </Button>
        </header>

        {/* Team summary */}
        <section>
          <h2 className="section-title mb-3">Your team <span className="font-normal text-muted-foreground">({team.data?.length ?? 0})</span></h2>
          {(team.data?.length ?? 0) === 0 ? (
            <div className="rounded-xl bg-card px-6 py-10 text-center border border-border/70">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary-soft text-primary-ink"><Users className="h-6 w-6" /></div>
              <p className="mt-4 text-body text-muted-foreground">No delivery partners on your team yet.</p>
              <Button className="mt-4" onClick={() => setTeamOpen(true)}>Select delivery team</Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {(team.data ?? []).map((p) => {
                const b = badgeFor(p);
                return (
              <div key={p.partner_id} className="group relative rounded-xl bg-card p-4 border border-border/70">
                    <button
                      onClick={() => removePartner(p.partner_id)}
                      className="absolute top-2 right-2 p-1 rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition md:opacity-0 md:group-hover:opacity-100 focus:opacity-100"
                      title="Remove from shop"
                      aria-label="Remove from shop"
                    >
                      <X className="h-4 w-4" />
                    </button>
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-body font-semibold">{p.name}</div>
                        <div className="truncate text-meta text-muted-foreground">{[p.phone, p.vehicle].filter(Boolean).join(" · ") || "—"}</div>
                      </div>
                      <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-caption font-semibold ${b.cls}`}>{b.label}</span>
                    </div>
                    {(p.current_order_number || p.eta_minutes != null) && (
                      <div className="mt-3 rounded-xl bg-secondary px-3 py-2 text-meta">
                        {p.current_order_number && (
                          <div>Order <span className="font-bold">{p.current_order_number}</span></div>
                        )}
                        {p.eta_minutes != null && (
                          <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                            <Clock className="h-3 w-3" /> ETA {p.eta_minutes} min
                          </div>
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-3 gap-2 mt-3 text-center">
                      <Mini label="Active" value={String(p.active_order_count ?? 0)} />
                      <Mini label="7d" value={String(perfByPartner[p.partner_id]?.orders_7d ?? 0)} />
                      <Mini label="Rating" value={p.rating != null ? Number(p.rating).toFixed(1) : "—"} />
                    </div>
                    <div className="mt-2 text-caption text-muted-foreground">Updated {timeAgo(p.status_updated_at)}</div>
                  </div>
                );
              })}
            </div>
          )}
        </section>



        {/* Active orders */}
        <section>
          <h2 className="section-title mb-3">Active orders</h2>
          <div className="space-y-3">
            {(orders.data ?? []).map((o: any) => {
              const p = teamById(o.partner_id);
              return (
                <div key={o.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-card p-4 border border-border/70">
                  <div className="min-w-0">
                    <div className="text-body font-semibold">{o.order_number} <span className="font-normal text-muted-foreground">· {rupees(o.total)}</span></div>
                    <div className="text-meta capitalize text-muted-foreground">{o.status.replace(/_/g, " ")} · {(o.address as any)?.line1}, {(o.address as any)?.city}</div>
                    <div className="mt-1 text-meta">
                      {p ? <span><span className="font-semibold">{p.name}</span> · {p.phone ?? "—"}</span>
                         : <span className="font-semibold text-warning-foreground">Unassigned</span>}
                    </div>
                  </div>
                  <Button size="sm" onClick={() => setAssignFor(o)}>{p ? "Re-assign" : "Assign delivery partner"}</Button>
                </div>
              );
            })}
            {(orders.data?.length ?? 0) === 0 && <div className="rounded-xl bg-card px-6 py-8 text-center text-body text-muted-foreground border border-border/70">No active deliveries.</div>}
          </div>
        </section>

        {/* Performance */}
        <section>
          <h2 className="section-title mb-3">Partner performance</h2>
          <div className="divide-y divide-border/60 rounded-xl border border-border/70 bg-card md:hidden">
            {(team.data ?? []).map((p) => {
              const b = badgeFor(p);
              const r = perfByPartner[p.partner_id];
              return (
                <div key={p.partner_id} className="p-3.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-body font-semibold">{p.name}</div>
                      <div className="text-small text-muted-foreground">{p.phone ?? "—"}</div>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-caption font-semibold ${b.cls}`}>{b.label}</span>
                  </div>
                  <div className="mt-2.5 grid grid-cols-3 gap-2 text-center">
                    <Mini label="Active" value={String(p.active_order_count ?? 0)} />
                    <Mini label="Done (7d)" value={String(r?.orders_7d ?? 0)} />
                    <Mini label="Rating" value={p.rating != null ? Number(p.rating).toFixed(1) : "—"} />
                  </div>
                </div>
              );
            })}
            {(team.data?.length ?? 0) === 0 && <div className="px-3 py-6 text-center text-meta text-muted-foreground">No team members yet.</div>}
          </div>
          <div className="hidden overflow-x-auto rounded-xl bg-card border border-border/70 md:block">
            <table className="w-full text-body">
              <thead className="bg-secondary/50 text-small text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Partner</th>
                  <th className="px-4 py-2.5 text-left font-medium">Status</th>
                  <th className="px-4 py-2.5 text-right font-medium">Active</th>
                  <th className="px-4 py-2.5 text-right font-medium">Completed (7d)</th>
                  <th className="px-4 py-2.5 text-right font-medium">Rating</th>
                </tr>
              </thead>
              <tbody>
                {(team.data ?? []).map((p) => {
                  const b = badgeFor(p);
                  const r = perfByPartner[p.partner_id];
                  return (
                    <tr key={p.partner_id} className="border-t border-border/60">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{p.name}</div>
                        <div className="text-xs text-muted-foreground">{p.phone ?? "—"}</div>
                      </td>
                      <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${b.cls}`}>{b.label}</span></td>
                      <td className="px-4 py-3 text-right font-bold">{p.active_order_count ?? 0}</td>
                      <td className="px-4 py-3 text-right">{r?.orders_7d ?? 0}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="inline-flex items-center gap-1">
                          <Star className="h-3 w-3 fill-accent text-accent" />
                          {p.rating != null ? Number(p.rating).toFixed(1) : "—"}
                        </span>
                      </td>
                    </tr>
                  );
                })}
                {(team.data?.length ?? 0) === 0 && (
                  <tr><td colSpan={5} className="px-3 py-6 text-center text-muted-foreground">No team members yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {shopId && (
        <SelectTeamDialog
          shopId={shopId}
          open={teamOpen}
          onOpenChange={setTeamOpen}
          onSaved={() => { qc.invalidateQueries({ queryKey: ["shop-team", shopId] }); }}
        />
      )}

      {/* Assign order dialog */}
      <Dialog open={!!assignFor} onOpenChange={(v) => !v && setAssignFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign delivery partner {assignFor ? `· ${assignFor.order_number}` : ""}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[60vh] overflow-auto">
            {(team.data ?? []).map((p) => {
              const b = badgeFor(p);
              const disabled = !p.is_online;
              return (
                <button
                  key={p.partner_id}
                  disabled={disabled}
                  onClick={() => assignFor && assign(assignFor.id, p.partner_id)}
                  className={`press flex min-h-12 w-full items-center justify-between gap-3 rounded-xl bg-secondary p-3.5 text-left transition ${disabled ? "cursor-not-allowed opacity-50" : "hover:bg-primary-soft"}`}
                >
                  <div className="min-w-0">
                    <div className="truncate text-body font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground">Active: {p.active_order_count ?? 0}{p.vehicle ? ` · ${p.vehicle}` : ""}</div>
                  </div>
                  <span className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${b.cls}`}>{b.label}</span>
                </button>
              );
            })}
            {(team.data?.length ?? 0) === 0 && (
              <div className="text-sm text-muted-foreground p-2">No partners on your team. Click "Select delivery team" to pick from the admin-created pool.</div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-secondary px-2 py-2">
      <div className="text-caption text-muted-foreground">{label}</div>
      <div className="text-body font-semibold">{value}</div>
    </div>
  );
}

function SelectTeamDialog({
  shopId, open, onOpenChange, onSaved,
}: { shopId: string; open: boolean; onOpenChange: (v: boolean) => void; onSaved: () => void }) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const available = useQuery({
    queryKey: ["shop-available-partners", shopId, open],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("shop_available_partners", { _shop_id: shopId });
      if (error) throw error;
      return (data ?? []) as AvailablePartner[];
    },
    enabled: open,
  });

  useEffect(() => {
    if (available.data) {
      setSelected(new Set(available.data.filter(p => p.on_team).map(p => p.partner_id)));
    }
  }, [available.data]);

  const toggle = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const save = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("shop_set_team", { _shop_id: shopId, _partner_ids: Array.from(selected) });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Delivery team saved");
    onOpenChange(false);
    onSaved();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Select delivery partners for your shop</DialogTitle>
        </DialogHeader>
        <div className="space-y-2 max-h-[60vh] overflow-auto">
          {(available.data ?? []).map((p) => {
            const b = badgeFor({ is_online: p.is_online });
            const checked = selected.has(p.partner_id);
            return (
              <label key={p.partner_id} className={`press flex min-h-12 cursor-pointer items-center gap-3 rounded-xl p-3.5 transition ${checked ? "bg-primary-soft ring-1 ring-primary" : "bg-secondary"}`}>
                <Checkbox checked={checked} onCheckedChange={() => toggle(p.partner_id)} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-body font-semibold">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{[p.phone, p.vehicle].filter(Boolean).join(" · ") || "—"}</div>
                </div>
                <span className={`rounded-full px-2.5 py-0.5 text-caption font-semibold ${b.cls}`}>{b.label}</span>
              </label>
            );
          })}
          {(available.data?.length ?? 0) === 0 && (
            <div className="text-sm text-muted-foreground p-2">No delivery partners exist yet. Ask admin to create some.</div>
          )}
        </div>
        <DialogFooter>
          <Button variant="secondary" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy}>{busy ? "Saving…" : `Save selection (${selected.size})`}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
