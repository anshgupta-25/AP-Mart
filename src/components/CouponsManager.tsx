import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, X, Ticket } from "lucide-react";

type CouponType = "percent" | "flat";

export type CouponRow = {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  min_order: number;
  max_discount: number | null;
  usage_limit: number | null;
  times_used: number;
  expires_at: string | null;
  active: boolean;
};

type FormState = Omit<CouponRow, "id" | "times_used"> & { id?: string };

const emptyForm = (): FormState => ({
  code: "",
  description: "",
  type: "percent",
  value: 10,
  min_order: 0,
  max_discount: null,
  usage_limit: null,
  expires_at: null,
  active: true,
});

function toLocalInput(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function CouponsManager({ readOnly = false }: { readOnly?: boolean }) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<FormState | null>(null);

  const list = useQuery({
    queryKey: ["coupons-manage"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coupons")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CouponRow[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (f: FormState) => {
      const payload: any = {
        code: f.code.trim().toUpperCase(),
        description: f.description || null,
        type: f.type,
        value: Number(f.value),
        min_order: Number(f.min_order) || 0,
        max_discount: f.max_discount === null || (f.max_discount as any) === "" ? null : Number(f.max_discount),
        usage_limit: f.usage_limit === null || (f.usage_limit as any) === "" ? null : Number(f.usage_limit),
        expires_at: f.expires_at || null,
        active: f.active,
      };
      const { error } = f.id
        ? await supabase.from("coupons").update(payload).eq("id", f.id)
        : await supabase.from("coupons").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coupon saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["coupons-manage"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const toggleActive = useMutation({
    mutationFn: async (c: CouponRow) => {
      const { error } = await supabase.from("coupons").update({ active: !c.active }).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["coupons-manage"] }),
    onError: (e: any) => toast.error(e.message ?? "Update failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coupons").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Coupon removed");
      qc.invalidateQueries({ queryKey: ["coupons-manage"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-display text-xl font-bold">Coupons</h2>
          <p className="text-xs text-muted-foreground">
            {readOnly
              ? "Promo codes available across the platform."
              : "Create promo codes, set discount, min order, expiry & usage limits."}
          </p>
        </div>
        {!readOnly && (
          <Button size="sm" onClick={() => setEditing(emptyForm())}>
            <Plus className="h-4 w-4 mr-1" /> New coupon
          </Button>
        )}
      </div>

      {list.isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      ) : list.data?.length === 0 ? (
        <div className="text-center py-12 rounded-2xl border border-dashed border-border text-sm text-muted-foreground">
          No coupons yet.
        </div>
      ) : (
        <div className="grid gap-2">
          {list.data!.map((c) => {
            const expired = c.expires_at && new Date(c.expires_at) < new Date();
            const used = c.usage_limit ? `${c.times_used}/${c.usage_limit}` : `${c.times_used}`;
            return (
              <div
                key={c.id}
                className="flex gap-3 items-center rounded-2xl border border-border bg-card p-3 shadow-card"
              >
                <div className="h-12 w-12 grid place-items-center rounded-xl bg-primary/10 text-primary">
                  <Ticket className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-sm font-mono">{c.code}</p>
                    <span className="text-[10px] font-bold rounded-full bg-secondary px-2 py-0.5">
                      {c.type === "percent" ? `${c.value}% OFF` : `₹${c.value} OFF`}
                    </span>
                    {!c.active && (
                      <span className="text-[10px] font-bold rounded-full bg-destructive/15 text-destructive px-2 py-0.5">
                        Inactive
                      </span>
                    )}
                    {expired && (
                      <span className="text-[10px] font-bold rounded-full bg-muted px-2 py-0.5">
                        Expired
                      </span>
                    )}
                  </div>
                  {c.description && (
                    <p className="text-xs text-muted-foreground truncate">{c.description}</p>
                  )}
                  <p className="text-[11px] text-muted-foreground">
                    Min ₹{c.min_order}
                    {c.max_discount ? ` · Max ₹${c.max_discount}` : ""}
                    {` · Used ${used}`}
                    {c.expires_at ? ` · Expires ${new Date(c.expires_at).toLocaleDateString()}` : ""}
                  </p>
                </div>
                {!readOnly && (
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={c.active}
                      onCheckedChange={() => toggleActive.mutate(c)}
                      aria-label="Toggle active"
                    />
                    <Button size="icon" variant="ghost" onClick={() => setEditing({ ...c })}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => confirm(`Delete coupon ${c.code}?`) && del.mutate(c.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {editing && !readOnly && (
        <div className="fixed inset-0 z-50 bg-foreground/50 backdrop-blur-sm grid place-items-center p-4">
          <div className="bg-card rounded-2xl border border-border w-full max-w-lg shadow-glow max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <h3 className="font-bold">{editing.id ? "Edit coupon" : "New coupon"}</h3>
              <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form
              className="p-4 space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!editing.code.trim()) {
                  toast.error("Code is required");
                  return;
                }
                if (!editing.value || Number(editing.value) <= 0) {
                  toast.error("Discount value must be greater than 0");
                  return;
                }
                if (editing.type === "percent" && Number(editing.value) > 100) {
                  toast.error("Percent value cannot exceed 100");
                  return;
                }
                upsert.mutate(editing);
              }}
            >
              <Field label="Code (e.g. FLASH50)">
                <Input
                  value={editing.code}
                  onChange={(e) => setEditing({ ...editing, code: e.target.value.toUpperCase() })}
                  maxLength={32}
                  required
                  className="font-mono uppercase"
                />
              </Field>
              <Field label="Description">
                <Input
                  value={editing.description ?? ""}
                  onChange={(e) => setEditing({ ...editing, description: e.target.value })}
                  maxLength={160}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Type">
                  <div className="flex gap-2">
                    {(["percent", "flat"] as CouponType[]).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setEditing({ ...editing, type: t })}
                        className={`px-3 py-1.5 rounded-full text-xs font-bold border ${
                          editing.type === t
                            ? "gradient-primary text-primary-foreground border-transparent"
                            : "border-border bg-card"
                        }`}
                      >
                        {t === "percent" ? "Percent %" : "Flat ₹"}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={editing.type === "percent" ? "Discount %" : "Discount ₹"}>
                  <Input
                    type="number"
                    min={1}
                    step="0.01"
                    value={editing.value}
                    onChange={(e) => setEditing({ ...editing, value: Number(e.target.value) })}
                    required
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Minimum order (₹)">
                  <Input
                    type="number"
                    min={0}
                    value={editing.min_order}
                    onChange={(e) => setEditing({ ...editing, min_order: Number(e.target.value) })}
                  />
                </Field>
                <Field label="Max discount (₹, optional)">
                  <Input
                    type="number"
                    min={0}
                    value={editing.max_discount ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        max_discount: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Usage limit (optional)">
                  <Input
                    type="number"
                    min={1}
                    value={editing.usage_limit ?? ""}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        usage_limit: e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </Field>
                <Field label="Expires at (optional)">
                  <Input
                    type="datetime-local"
                    value={toLocalInput(editing.expires_at)}
                    onChange={(e) =>
                      setEditing({
                        ...editing,
                        expires_at: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                  />
                </Field>
              </div>
              <div className="flex items-center gap-2 pt-1">
                <Switch
                  checked={editing.active}
                  onCheckedChange={(v) => setEditing({ ...editing, active: v })}
                />
                <Label className="text-sm">Active</Label>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={upsert.isPending}>
                  {upsert.isPending ? "Saving…" : "Save coupon"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <Label className="text-xs font-bold">{label}</Label>
      {children}
    </div>
  );
}
