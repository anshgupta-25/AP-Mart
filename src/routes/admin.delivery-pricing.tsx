import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/RoleShell";
import { ADMIN_NAV } from "./admin.dashboard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Truck, Plus, Pencil, Trash2, Copy, Eye, MoreVertical, Search, ArrowLeft, Zap, Rocket } from "lucide-react";
import { rupees } from "@/lib/format";

export const Route = createFileRoute("/admin/delivery-pricing")({
  head: () => ({ meta: [{ title: "Delivery Pricing — AP Mart Admin" }] }),
  component: Page,
});

type Zone = {
  id: string;
  state: string; city: string; pin_code: string;
  is_active: boolean; delivery_radius_km: number | string;
  standard_enabled: boolean; standard_fee: number | string; standard_eta_minutes: string; minimum_order_standard: number | string | null;
  fast_enabled: boolean; fast_fee: number | string; fast_eta_minutes: string; minimum_order_fast: number | string | null;
  express_enabled: boolean; express_fee: number | string; express_eta_minutes: string; minimum_order_express: number | string | null;
  handling_enabled?: boolean;
  handling_type?: "fixed" | "percent";
  default_handling_fee?: number | string;
  handling_percentage?: number | string;
  free_handling_above?: number | string | null;
  standard_handling_fee?: number | string | null;
  fast_handling_fee?: number | string | null;
  express_handling_fee?: number | string | null;
};

const empty: Zone = {
  id: "", state: "", city: "", pin_code: "",
  is_active: true, delivery_radius_km: 10,
  standard_enabled: true, standard_fee: 20, standard_eta_minutes: "45-60", minimum_order_standard: null,
  fast_enabled: true, fast_fee: 49, fast_eta_minutes: "20-30", minimum_order_fast: null,
  express_enabled: false, express_fee: 99, express_eta_minutes: "10-15", minimum_order_express: null,
  handling_enabled: false, handling_type: "fixed", default_handling_fee: 5, handling_percentage: 0,
  free_handling_above: null, standard_handling_fee: null, fast_handling_fee: null, express_handling_fee: null,
};

function Page() {
  const qc = useQueryClient();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "inactive" | "standard" | "fast" | "express">("all");
  const [edit, setEdit] = useState<Zone | null>(null);
  const [view, setView] = useState<Zone | null>(null);
  const [confirmDel, setConfirmDel] = useState<Zone | null>(null);

  const zones = useQuery({
    queryKey: ["admin-delivery-zones"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("admin_list_delivery_zones");
      if (error) throw error;
      return (data ?? []) as Zone[];
    },
  });

  const filtered = useMemo(() => {
    const list = zones.data ?? [];
    const term = q.trim().toLowerCase();
    return list.filter((z) => {
      if (term && !`${z.pin_code} ${z.city} ${z.state}`.toLowerCase().includes(term)) return false;
      if (filter === "active") return z.is_active;
      if (filter === "inactive") return !z.is_active;
      if (filter === "standard") return z.standard_enabled;
      if (filter === "fast") return z.fast_enabled;
      if (filter === "express") return z.express_enabled;
      return true;
    });
  }, [zones.data, q, filter]);

  const save = async (z: Zone) => {
    if (!z.state || !z.city || !z.pin_code) { toast.error("State, City and PIN Code are required"); return; }
    if (!/^\d{4,10}$/.test(z.pin_code)) { toast.error("Invalid PIN Code"); return; }
    const { error } = await (supabase as any).rpc("admin_upsert_delivery_zone", { _data: z });
    if (error) { toast.error(error.message); return; }
    toast.success(z.id ? "Zone updated" : "Zone added");
    setEdit(null);
    qc.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
  };

  const del = async (z: Zone) => {
    const { error } = await (supabase as any).rpc("admin_delete_delivery_zone", { _id: z.id });
    if (error) return toast.error(error.message);
    toast.success("Deleted");
    setConfirmDel(null);
    qc.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
  };

  const duplicate = async (z: Zone) => {
    const newPin = window.prompt(`Duplicate ${z.pin_code} — enter a new PIN Code:`);
    if (!newPin) return;
    const { error } = await (supabase as any).rpc("admin_duplicate_delivery_zone", { _id: z.id, _new_pin: newPin.trim() });
    if (error) return toast.error(error.message);
    toast.success("Duplicated");
    qc.invalidateQueries({ queryKey: ["admin-delivery-zones"] });
  };

  return (
    <RoleShell role="admin" nav={ADMIN_NAV} requireRoles={["admin"]}>
      <div className="p-4 md:p-6 space-y-6">
        <header className="flex flex-col sm:flex-row sm:items-start gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Link to="/admin/delivery-partners" className="inline-flex items-center gap-1 hover:text-foreground">
                <ArrowLeft className="h-4 w-4" /> Delivery Management
              </Link>
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-extrabold flex items-center gap-2 mt-1">
              <Truck className="h-6 w-6 text-primary" /> PIN Code Delivery Pricing & Speed Management
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              Configure delivery charges, delivery speed, and service availability for each PIN Code.
            </p>
          </div>
          <Button onClick={() => setEdit({ ...empty })} className="shrink-0">
            <Plus className="h-4 w-4 mr-1" /> Add PIN Code
          </Button>
        </header>

        <section className="flex flex-col md:flex-row gap-2 md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={q} onChange={(e) => setQ(e.target.value)}
              placeholder="Search by PIN Code, city, or state…"
              className="pl-9"
            />
          </div>
          <Select value={filter} onValueChange={(v) => setFilter(v as any)}>
            <SelectTrigger className="w-full md:w-56"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All zones</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
              <SelectItem value="standard">Standard enabled</SelectItem>
              <SelectItem value="fast">Fast enabled</SelectItem>
              <SelectItem value="express">Express enabled</SelectItem>
            </SelectContent>
          </Select>
        </section>

        <section className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <Th>State</Th><Th>City</Th><Th>PIN</Th><Th>Status</Th>
                  <Th>Standard</Th><Th>Fast</Th><Th>Express</Th>
                  <Th>Radius</Th><Th className="text-right pr-4">Actions</Th>
                </tr>
              </thead>
              <tbody>
                {zones.isLoading && (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">Loading…</td></tr>
                )}
                {!zones.isLoading && filtered.length === 0 && (
                  <tr><td colSpan={9} className="p-6 text-center text-muted-foreground">
                    No zones yet. Click <b>Add PIN Code</b> to create one.
                  </td></tr>
                )}
                {filtered.map((z) => (
                  <tr key={z.id} className="border-t border-border">
                    <Td>{z.state}</Td>
                    <Td>{z.city}</Td>
                    <Td className="font-mono font-semibold">{z.pin_code}</Td>
                    <Td>
                      <Badge variant={z.is_active ? "default" : "secondary"}>
                        {z.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </Td>
                    <Td><TierCell enabled={z.standard_enabled} fee={z.standard_fee} eta={z.standard_eta_minutes} /></Td>
                    <Td><TierCell enabled={z.fast_enabled} fee={z.fast_fee} eta={z.fast_eta_minutes} /></Td>
                    <Td><TierCell enabled={z.express_enabled} fee={z.express_fee} eta={z.express_eta_minutes} /></Td>
                    <Td>{Number(z.delivery_radius_km)} km</Td>
                    <Td className="text-right pr-4">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon"><MoreVertical className="h-4 w-4" /></Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setView(z)}><Eye className="h-4 w-4 mr-2" />View</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => setEdit(z)}><Pencil className="h-4 w-4 mr-2" />Edit</DropdownMenuItem>
                          <DropdownMenuItem onClick={() => duplicate(z)}><Copy className="h-4 w-4 mr-2" />Duplicate</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={() => setConfirmDel(z)}>
                            <Trash2 className="h-4 w-4 mr-2" />Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {edit && (
        <ZoneDialog
          zone={edit}
          onClose={() => setEdit(null)}
          onSave={save}
        />
      )}

      {view && (
        <Dialog open onOpenChange={() => setView(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{view.city}, {view.state} — {view.pin_code}</DialogTitle></DialogHeader>
            <div className="space-y-2 text-sm">
              <Row k="Status" v={view.is_active ? "Active" : "Inactive"} />
              <Row k="Radius" v={`${view.delivery_radius_km} km`} />
              <TierView label="🚚 Standard" enabled={view.standard_enabled} fee={view.standard_fee} eta={view.standard_eta_minutes} min={view.minimum_order_standard} />
              <TierView label="⚡ Fast" enabled={view.fast_enabled} fee={view.fast_fee} eta={view.fast_eta_minutes} min={view.minimum_order_fast} />
              <TierView label="🚀 Express" enabled={view.express_enabled} fee={view.express_fee} eta={view.express_eta_minutes} min={view.minimum_order_express} />
            </div>
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(o) => !o && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete zone {confirmDel?.pin_code}?</AlertDialogTitle>
            <AlertDialogDescription>Customers in this PIN Code will lose configured delivery options.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && del(confirmDel)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </RoleShell>
  );
}

function Th({ children, className = "" }: any) {
  return <th className={`px-3 py-2 font-semibold text-xs uppercase tracking-wide text-muted-foreground ${className}`}>{children}</th>;
}
function Td({ children, className = "" }: any) {
  return <td className={`px-3 py-2 align-middle ${className}`}>{children}</td>;
}
function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between border-b border-border py-1"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}
function TierCell({ enabled, fee, eta }: { enabled: boolean; fee: any; eta: string }) {
  if (!enabled) return <span className="text-muted-foreground">—</span>;
  return <div className="text-xs"><div className="font-semibold">{rupees(Number(fee))}</div><div className="text-muted-foreground">{eta} min</div></div>;
}
function TierView({ label, enabled, fee, eta, min }: any) {
  return (
    <div className="rounded-xl border border-border p-3">
      <div className="flex items-center justify-between">
        <span className="font-semibold">{label}</span>
        <Badge variant={enabled ? "default" : "secondary"}>{enabled ? "Enabled" : "Disabled"}</Badge>
      </div>
      {enabled && (
        <div className="mt-1 text-xs text-muted-foreground">
          {rupees(Number(fee))} • {eta} min{min ? ` • Min order ${rupees(Number(min))}` : ""}
        </div>
      )}
    </div>
  );
}

function ZoneDialog({ zone, onClose, onSave }: { zone: Zone; onClose: () => void; onSave: (z: Zone) => void | Promise<void> }) {
  const [z, setZ] = useState<Zone>({ ...zone });
  const set = <K extends keyof Zone>(k: K, v: Zone[K]) => setZ((p) => ({ ...p, [k]: v }));

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{z.id ? "Edit" : "Add"} PIN Code</DialogTitle></DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="State"><Input value={z.state} onChange={(e) => set("state", e.target.value)} /></Field>
          <Field label="City"><Input value={z.city} onChange={(e) => set("city", e.target.value)} /></Field>
          <Field label="PIN Code"><Input value={z.pin_code} onChange={(e) => set("pin_code", e.target.value)} /></Field>
          <Field label="Delivery Radius (km)"><Input type="number" value={String(z.delivery_radius_km)} onChange={(e) => set("delivery_radius_km", e.target.value)} /></Field>
          <div className="flex items-center gap-2 pt-6">
            <Switch checked={z.is_active} onCheckedChange={(v) => set("is_active", v)} />
            <Label>{z.is_active ? "Active" : "Inactive"}</Label>
          </div>
        </div>

        <TierBlock
          title="🚚 Standard Delivery"
          enabled={z.standard_enabled} fee={z.standard_fee} eta={z.standard_eta_minutes} min={z.minimum_order_standard}
          onEnabled={(v) => set("standard_enabled", v)}
          onFee={(v) => set("standard_fee", v)}
          onEta={(v) => set("standard_eta_minutes", v)}
          onMin={(v) => set("minimum_order_standard", v)}
        />
        <TierBlock
          title="⚡ Fast Delivery"
          enabled={z.fast_enabled} fee={z.fast_fee} eta={z.fast_eta_minutes} min={z.minimum_order_fast}
          onEnabled={(v) => set("fast_enabled", v)}
          onFee={(v) => set("fast_fee", v)}
          onEta={(v) => set("fast_eta_minutes", v)}
          onMin={(v) => set("minimum_order_fast", v)}
        />
        <TierBlock
          title="🚀 Express Delivery"
          enabled={z.express_enabled} fee={z.express_fee} eta={z.express_eta_minutes} min={z.minimum_order_express}
          onEnabled={(v) => set("express_enabled", v)}
          onFee={(v) => set("express_fee", v)}
          onEta={(v) => set("express_eta_minutes", v)}
          onMin={(v) => set("minimum_order_express", v)}
        />

        <div className="rounded-xl border border-border p-3 space-y-3">
          <div className="flex items-center justify-between">
            <div className="font-semibold">📦 Handling Charges</div>
            <div className="flex items-center gap-2">
              <Switch checked={!!z.handling_enabled} onCheckedChange={(v) => set("handling_enabled", v)} />
              <Label>{z.handling_enabled ? "Enabled" : "Disabled"}</Label>
            </div>
          </div>
          {z.handling_enabled && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="Fee Type">
                  <Select value={z.handling_type ?? "fixed"} onValueChange={(v) => set("handling_type", v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                      <SelectItem value="percent">Percentage (%)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                {z.handling_type === "percent" ? (
                  <Field label="Handling Percentage (%)">
                    <Input type="number" value={String(z.handling_percentage ?? "")} onChange={(e) => set("handling_percentage", e.target.value as any)} />
                  </Field>
                ) : (
                  <Field label="Handling Fee (₹)">
                    <Input type="number" value={String(z.default_handling_fee ?? "")} onChange={(e) => set("default_handling_fee", e.target.value as any)} />
                  </Field>
                )}
                <Field label="Free Handling Above (₹, optional)">
                  <Input type="number" value={String(z.free_handling_above ?? "")} onChange={(e) => set("free_handling_above", e.target.value as any)} />
                </Field>
              </div>
              <div className="text-xs text-muted-foreground pt-1">Per-tier overrides (leave blank to use default)</div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <Field label="🚚 Standard (₹)">
                  <Input type="number" value={String(z.standard_handling_fee ?? "")} onChange={(e) => set("standard_handling_fee", e.target.value as any)} />
                </Field>
                <Field label="⚡ Fast (₹)">
                  <Input type="number" value={String(z.fast_handling_fee ?? "")} onChange={(e) => set("fast_handling_fee", e.target.value as any)} />
                </Field>
                <Field label="🚀 Express (₹)">
                  <Input type="number" value={String(z.express_handling_fee ?? "")} onChange={(e) => set("express_handling_fee", e.target.value as any)} />
                </Field>
              </div>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancel</Button>
          <Button onClick={() => onSave(z)}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TierBlock({ title, enabled, fee, eta, min, onEnabled, onFee, onEta, onMin }: {
  title: string; enabled: boolean; fee: any; eta: string; min: any;
  onEnabled: (v: boolean) => void; onFee: (v: string) => void; onEta: (v: string) => void; onMin: (v: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border p-3 space-y-3">
      <div className="flex items-center justify-between">
        <div className="font-semibold">{title}</div>
        <div className="flex items-center gap-2">
          <Switch checked={enabled} onCheckedChange={onEnabled} />
          <Label>{enabled ? "Enabled" : "Disabled"}</Label>
        </div>
      </div>
      {enabled && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <Field label="Delivery Fee (₹)"><Input type="number" value={String(fee ?? "")} onChange={(e) => onFee(e.target.value)} /></Field>
          <Field label="ETA (e.g. 30-45)"><Input value={eta ?? ""} onChange={(e) => onEta(e.target.value)} /></Field>
          <Field label="Min Order (₹, optional)"><Input type="number" value={String(min ?? "")} onChange={(e) => onMin(e.target.value)} /></Field>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1"><Label className="text-xs">{label}</Label>{children}</div>;
}
