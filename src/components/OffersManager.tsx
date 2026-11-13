import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Pencil, Trash2, Plus, X } from "lucide-react";
import { ImageInput } from "@/components/ImageInput";
import { StorageImg } from "@/components/StorageImg";

function ImageInputWrapper(props: { value: string; onChange: (v: string) => void }) {
  return <ImageInput value={props.value} onChange={props.onChange} bucket="offers" label="Offer image" required />;
}

type OfferScope = "global" | "shop";

export type OfferRow = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  badge: string | null;
  scope: OfferScope;
  shop_id: string | null;
  is_active: boolean;
  display_order: number;
};

type FormState = Omit<OfferRow, "id"> & { id?: string };

const emptyForm = (defaults: Partial<FormState>): FormState => ({
  title: "",
  subtitle: "",
  image_url: "",
  link_url: "",
  badge: "",
  scope: "global",
  shop_id: null,
  is_active: true,
  display_order: 0,
  ...defaults,
});

/**
 * Reusable offers manager. Use lockedScope='shop' + shopId for shopkeepers,
 * or omit for admins to manage all offers.
 */
export function OffersManager({
  lockedScope,
  shopId,
  shops,
}: {
  lockedScope?: OfferScope;
  shopId?: string | null;
  shops?: { id: string; name: string }[];
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<FormState | null>(null);

  const list = useQuery({
    queryKey: ["offers-manage", lockedScope ?? "all", shopId ?? "*"],
    queryFn: async () => {
      let q = supabase.from("offers" as any).select("*").order("display_order");
      if (lockedScope === "shop" && shopId) q = q.eq("shop_id", shopId);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as unknown as OfferRow[];
    },
  });

  const upsert = useMutation({
    mutationFn: async (f: FormState) => {
      const payload: any = {
        title: f.title,
        subtitle: f.subtitle || null,
        image_url: f.image_url,
        link_url: f.link_url || null,
        badge: f.badge || null,
        scope: f.scope,
        shop_id: f.scope === "shop" ? f.shop_id : null,
        is_active: f.is_active,
        display_order: Number(f.display_order) || 0,
      };
      const { error } = f.id
        ? await supabase.from("offers" as any).update(payload).eq("id", f.id)
        : await supabase.from("offers" as any).insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Offer saved");
      setEditing(null);
      qc.invalidateQueries({ queryKey: ["offers-manage"] });
      qc.invalidateQueries({ queryKey: ["offers-public"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Save failed"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("offers" as any).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Offer removed");
      qc.invalidateQueries({ queryKey: ["offers-manage"] });
      qc.invalidateQueries({ queryKey: ["offers-public"] });
    },
    onError: (e: any) => toast.error(e.message ?? "Delete failed"),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h2 className="large-title">Offers</h2>
          <p className="mt-1 text-body text-muted-foreground">
            {lockedScope === "shop"
              ? "Promotions shown on the storefront for your shop's customers."
              : "Promotional banners shown on the home page."}
          </p>
        </div>
        <Button
          onClick={() =>
            setEditing(
              emptyForm({
                scope: lockedScope ?? "global",
                shop_id: lockedScope === "shop" ? shopId ?? null : null,
              }),
            )
          }
        >
          <Plus className="mr-1.5 h-4 w-4" /> New offer
        </Button>
      </div>

      {list.isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : list.data?.length === 0 ? (
        <div className="rounded-xl bg-card px-6 py-12 text-center border border-border/70">
          <div className="text-body font-semibold">No offers yet</div>
          <p className="mt-1 text-body text-muted-foreground">Create one to promote your shop.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {list.data!.map((o) => (
            <div
              key={o.id}
              className="flex items-center gap-3.5 rounded-xl bg-card p-3 border border-border/70"
            >
              <StorageImg
                src={o.image_url}
                alt=""
                className="h-16 w-24 rounded-xl bg-secondary object-cover"
                onError={(e) => ((e.target as HTMLImageElement).style.opacity = "0.3")}
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="truncate text-body font-semibold">{o.title}</p>
                  <span className="rounded-full bg-secondary px-2.5 py-0.5 text-caption font-semibold capitalize text-muted-foreground">
                    {o.scope}
                  </span>
                  {!o.is_active && (
                    <span className="rounded-full bg-tint-rose px-2.5 py-0.5 text-caption font-semibold text-destructive">
                      Inactive
                    </span>
                  )}
                </div>
                {o.subtitle && <p className="truncate text-meta text-muted-foreground">{o.subtitle}</p>}
                <p className="truncate text-small text-muted-foreground">{o.link_url || "—"}</p>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => setEditing(o)}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => confirm("Delete this offer?") && del.mutate(o.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 z-50 grid place-items-end bg-foreground/40 p-0 sm:place-items-center sm:p-4">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-card shadow-float sm:rounded-2xl">
            <div className="hairline-b flex items-center justify-between px-4 py-4">
              <h3 className="section-title">{editing.id ? "Edit offer" : "New offer"}</h3>
              <Button size="icon" variant="ghost" onClick={() => setEditing(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
            <form
              className="space-y-4 p-4"
              onSubmit={(e) => {
                e.preventDefault();
                if (!editing.title || !editing.image_url) {
                  toast.error("Title and image URL are required");
                  return;
                }
                if (editing.scope === "shop" && !editing.shop_id) {
                  toast.error("Pick a shop for this offer");
                  return;
                }
                upsert.mutate(editing);
              }}
            >
              <Field label="Title">
                <Input
                  value={editing.title}
                  onChange={(e) => setEditing({ ...editing, title: e.target.value })}
                  required
                />
              </Field>
              <Field label="Subtitle">
                <Input
                  value={editing.subtitle ?? ""}
                  onChange={(e) => setEditing({ ...editing, subtitle: e.target.value })}
                />
              </Field>
              <ImageInputWrapper
                value={editing.image_url}
                onChange={(url) => setEditing({ ...editing, image_url: url })}
              />
              <Field label="Link URL (e.g. /category/dairy)">
                <Input
                  value={editing.link_url ?? ""}
                  onChange={(e) => setEditing({ ...editing, link_url: e.target.value })}
                />
              </Field>
              <Field label="Badge (optional, e.g. NEW)">
                <Input
                  value={editing.badge ?? ""}
                  onChange={(e) => setEditing({ ...editing, badge: e.target.value })}
                />
              </Field>
              {!lockedScope && (
                <Field label="Scope">
                  <div className="flex gap-2">
                    {(["global", "shop"] as OfferScope[]).map((s) => (
                      <button
                        key={s}
                        type="button"
                        onClick={() => setEditing({ ...editing, scope: s })}
                        className={`press h-9 rounded-full px-4 text-meta font-semibold ${
                          editing.scope === s
                            ? "bg-foreground text-background"
                            : "bg-secondary"
                        }`}
                      >
                        {s === "global" ? "Global (home page)" : "Per-shop"}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              {editing.scope === "shop" && !lockedScope && shops && (
                <Field label="Shop">
                  <select
                    className="h-11 w-full rounded-xl bg-secondary px-3.5 text-body outline-none focus:ring-4 focus:ring-ring/15"
                    value={editing.shop_id ?? ""}
                    onChange={(e) => setEditing({ ...editing, shop_id: e.target.value || null })}
                    required
                  >
                    <option value="">— Choose a shop —</option>
                    {shops.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <div className="grid grid-cols-2 gap-3">
                <Field label="Display order">
                  <Input
                    type="number"
                    value={editing.display_order}
                    onChange={(e) =>
                      setEditing({ ...editing, display_order: Number(e.target.value) })
                    }
                  />
                </Field>
                <div className="flex items-end gap-2 pb-2">
                  <Switch
                    checked={editing.is_active}
                    onCheckedChange={(v) => setEditing({ ...editing, is_active: v })}
                  />
                  <Label className="text-body font-medium">Active</Label>
                </div>
              </div>

              {editing.image_url && (
                <div className="overflow-hidden rounded-xl">
                  <StorageImg loading="lazy" decoding="async" src={editing.image_url} alt="" className="w-full h-32 object-cover" />
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <Button type="button" variant="secondary" className="h-11 flex-1 rounded-xl" onClick={() => setEditing(null)}>
                  Cancel
                </Button>
                <Button type="submit" className="h-11 flex-[2] rounded-xl" disabled={upsert.isPending}>
                  {upsert.isPending ? "Saving…" : "Save offer"}
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
    <div className="space-y-1.5">
      <Label className="text-meta font-medium text-foreground/80">{label}</Label>
      {children}
    </div>
  );
}
