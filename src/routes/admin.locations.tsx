import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { RoleShell } from "@/components/RoleShell";
import { ADMIN_NAV } from "@/lib/adminNav";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Trash2, Plus, Loader2, AlertTriangle, RefreshCw } from "lucide-react";
import { describeError } from "@/lib/dbError";
import { isValidPincode, normalizePincode, normalizePlace } from "@/lib/pincode";

export const Route = createFileRoute("/admin/locations")({
  head: () => ({
    meta: [
      { title: "Serviceable Locations — AP Mart Admin" },
      { name: "description", content: "Manage the states, cities and PIN codes AP Mart delivers to." },
      { property: "og:title", content: "Serviceable Locations — AP Mart Admin" },
      { property: "og:description", content: "Add, deactivate or remove delivery locations by state, city and PIN code." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: LocationsPage,
});

interface Row {
  id: string;
  state: string;
  city: string;
  pincode: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

const LOCATION_KEYS = [["admin-locations"], ["locations", "active"]];

function LocationsPage() {
  const qc = useQueryClient();
  const [state, setState] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [filter, setFilter] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const invalidate = () => {
    for (const key of LOCATION_KEYS) qc.invalidateQueries({ queryKey: key });
  };

  const q = useQuery({
    queryKey: ["admin-locations"],
    queryFn: async (): Promise<Row[]> => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, state, city, pincode, is_active, created_at, updated_at")
        .order("state")
        .order("city")
        .order("pincode");
      if (error) throw describeError(error, "load locations");
      return data ?? [];
    },
    staleTime: 0,
    retry: 1,
  });

  const rows = useMemo(() => {
    const f = filter.replace(/\s+/g, " ").trim().toLowerCase();
    const all = q.data ?? [];
    if (!f) return all;
    const digits = f.replace(/\D/g, "");
    return all.filter((r) => {
      const hay = `${r.state} ${r.city} ${r.pincode}`.toLowerCase();
      return hay.includes(f) || (digits.length > 0 && r.pincode.includes(digits));
    });
  }, [q.data, filter]);

  const addMutation = useMutation({
    mutationFn: async () => {
      const s = normalizePlace(state);
      const c = normalizePlace(city);
      const p = normalizePincode(pincode);
      if (!s) throw new Error("State is required");
      if (!c) throw new Error("City is required");
      if (!isValidPincode(p)) throw new Error("PIN code must be exactly 6 digits (e.g. 201301)");

      // Duplicate check against the live database (case-insensitive).
      const { data: existing, error: dupErr } = await supabase
        .from("locations")
        .select("id, state, city, pincode, is_active")
        .eq("pincode", p)
        .ilike("state", s)
        .ilike("city", c)
        .limit(1);
      if (dupErr) throw describeError(dupErr, "check duplicate location");
      if (existing && existing.length > 0) {
        throw new Error(`${s} / ${c} / ${p} already exists in the location list`);
      }

      const payload = { state: s, city: c, pincode: p, is_active: true };
      const { data, error } = await supabase
        .from("locations")
        .insert(payload)
        .select("id, state, city, pincode, is_active")
        .single();
      if (error) {
        if ((error as { code?: string }).code === "23505") {
          throw new Error(`${s} / ${c} / ${p} already exists in the location list`);
        }
        throw describeError(error, "add location", payload);
      }
      return data as Row;
    },
    onSuccess: (row) => {
      // Clear the form only after the database confirmed the insert.
      setState("");
      setCity("");
      setPincode("");
      toast.success(`Added ${row.state} / ${row.city} / ${row.pincode}`);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async (r: Row) => {
      const next = !r.is_active;
      const { data, error } = await supabase
        .from("locations")
        .update({ is_active: next })
        .eq("id", r.id)
        .select("id, is_active")
        .single();
      if (error) throw describeError(error, "update location status", { id: r.id, is_active: next });
      if (!data) throw new Error("Location not found or you don't have permission to change it");
      return data;
    },
    onSettled: () => setBusyId(null),
    onSuccess: (data) => {
      toast.success(data.is_active ? "Location activated" : "Location deactivated");
      invalidate();
    },
    // No optimistic write: the list is refetched from the database, so a
    // failed update simply leaves the previous (correct) state on screen.
    onError: (e: Error) => {
      toast.error(e.message);
      invalidate();
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (r: Row) => {
      // Nothing references locations by foreign key, but shops / addresses
      // reference the same PIN code by value — warn before a hard delete.
      const [shops, addresses] = await Promise.all([
        supabase.from("shops").select("id", { count: "exact", head: true }).eq("pincode", r.pincode),
        supabase.from("addresses").select("id", { count: "exact", head: true }).eq("pincode", r.pincode),
      ]);
      const inUse = (shops.count ?? 0) + (addresses.count ?? 0);
      if (inUse > 0) {
        const ok = window.confirm(
          `PIN ${r.pincode} is used by ${shops.count ?? 0} shop(s) and ${addresses.count ?? 0} customer address(es).\n\n` +
            `Deleting the location will not delete that data, but customers can no longer select this PIN.\n\n` +
            `Click Cancel to deactivate it instead (recommended).`,
        );
        if (!ok) {
          const { error } = await supabase.from("locations").update({ is_active: false }).eq("id", r.id);
          if (error) throw describeError(error, "deactivate location", { id: r.id });
          return { softDeleted: true };
        }
      }
      const { error } = await supabase.from("locations").delete().eq("id", r.id);
      if (error) throw describeError(error, "delete location", { id: r.id });
      return { softDeleted: false };
    },
    onSettled: () => setBusyId(null),
    onSuccess: (res) => {
      toast.success(res.softDeleted ? "Location deactivated" : "Location deleted");
      invalidate();
    },
    onError: (e: Error) => {
      toast.error(e.message);
      invalidate();
    },
  });

  const rowBusy = (id: string) => busyId === id;

  return (
    <RoleShell role="admin" nav={ADMIN_NAV}>
      <div className="space-y-6">
        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-lg font-bold mb-3">Add location</h2>
          <form
            className="grid grid-cols-1 md:grid-cols-4 gap-3"
            onSubmit={(e) => {
              e.preventDefault();
              if (!addMutation.isPending) addMutation.mutate();
            }}
          >
            <div>
              <Label>State</Label>
              <Input value={state} onChange={(e) => setState(e.target.value)} placeholder="Uttar Pradesh" className="mt-1" />
            </div>
            <div>
              <Label>City</Label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} placeholder="Noida" className="mt-1" />
            </div>
            <div>
              <Label>PIN Code</Label>
              <Input
                value={pincode}
                onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
                placeholder="201301"
                maxLength={6}
                className="mt-1 font-mono"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={addMutation.isPending} className="w-full gap-2">
                {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {addMutation.isPending ? "Saving…" : "Add"}
              </Button>
            </div>
          </form>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5 shadow-card">
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <h2 className="font-display text-lg font-bold">
              All locations ({q.isSuccess ? q.data.length : "—"})
            </h2>
            <div className="flex items-center gap-2">
              <Input
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder="Search state, city, PIN…"
                className="max-w-xs"
              />
              <Button variant="outline" size="icon" onClick={() => q.refetch()} disabled={q.isFetching} aria-label="Refresh">
                <RefreshCw className={`h-4 w-4 ${q.isFetching ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {q.isLoading ? (
            <div className="py-10 text-center text-muted-foreground inline-flex w-full items-center justify-center gap-2">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading locations...
            </div>
          ) : q.isError ? (
            <div className="py-8 text-center space-y-3">
              <div className="inline-flex items-center gap-2 text-destructive font-semibold">
                <AlertTriangle className="h-4 w-4" /> Unable to load locations. Please try again.
              </div>
              <p className="text-xs text-muted-foreground break-words max-w-xl mx-auto">
                {(q.error as Error)?.message}
              </p>
              <Button variant="outline" onClick={() => q.refetch()}>Retry</Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground border-b">
                    <th className="py-2 px-2">State</th>
                    <th className="py-2 px-2">City</th>
                    <th className="py-2 px-2">PIN</th>
                    <th className="py-2 px-2">Active</th>
                    <th className="py-2 px-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className="border-b hover:bg-muted/40">
                      <td className="py-2 px-2">{r.state}</td>
                      <td className="py-2 px-2">{r.city}</td>
                      <td className="py-2 px-2 font-mono">{r.pincode}</td>
                      <td className="py-2 px-2">
                        <Switch
                          checked={r.is_active}
                          disabled={rowBusy(r.id)}
                          onCheckedChange={() => {
                            setBusyId(r.id);
                            toggleMutation.mutate(r);
                          }}
                        />
                      </td>
                      <td className="py-2 px-2 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={rowBusy(r.id)}
                          onClick={() => {
                            if (!window.confirm("Are you sure you want to delete this location?")) return;
                            setBusyId(r.id);
                            deleteMutation.mutate(r);
                          }}
                          className="text-destructive"
                        >
                          {rowBusy(r.id) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {rows.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-muted-foreground">
                        {filter ? "No locations match your search." : "No locations found."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </RoleShell>
  );
}
