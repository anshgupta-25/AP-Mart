import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Star, Layers, Tag } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImageInput } from "@/components/ImageInput";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { slugifySubcategory, type Subcategory } from "@/hooks/useSubcategories";
import { StorageImg } from "@/components/StorageImg";

/**
 * Admin / Super Admin subcategory management for a single category.
 * Shopkeepers never reach this component — RLS also blocks their writes.
 */
export function SubcategoryManager({
  categoryId,
  categoryName,
  open,
  onOpenChange,
}: {
  categoryId: string;
  categoryName: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Subcategory | null>(null);
  const [formOpen, setFormOpen] = useState(false);

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-subcategories", categoryId],
    enabled: open && !!categoryId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("subcategories")
        .select("id, category_id, name, slug, image_url, icon, display_order, is_active, is_featured")
        .eq("category_id", categoryId)
        .order("display_order")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Subcategory[];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["admin-subcategories", categoryId] });
    qc.invalidateQueries({ queryKey: ["subcategories"] });
    qc.invalidateQueries({ queryKey: ["category-subcategories"] });
  };

  const save = useMutation({
    mutationFn: async (s: Partial<Subcategory>) => {
      const payload = {
        category_id: categoryId,
        name: s.name,
        slug: s.slug || slugifySubcategory(s.name ?? ""),
        image_url: s.image_url || null,
        icon: s.icon || null,
        display_order: s.display_order ?? 0,
        is_active: s.is_active ?? true,
        is_featured: s.is_featured ?? false,
      };
      if (editing?.id) {
        const { error } = await (supabase as any)
          .from("subcategories")
          .update(payload)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("subcategories").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("Subcategory saved");
      invalidate();
      setFormOpen(false);
      setEditing(null);
    },
    onError: (e: any) => toast.error(e?.message ?? "Something went wrong"),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<Subcategory> }) => {
      const { error } = await (supabase as any).from("subcategories").update(values).eq("id", id);
      if (error) throw error;
    },
    onSuccess: invalidate,
    onError: (e: any) => toast.error(e?.message ?? "Something went wrong"),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("subcategories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Subcategory deleted");
      invalidate();
    },
    onError: (e: any) => toast.error(e?.message ?? "Something went wrong"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layers className="h-4 w-4" />
            {categoryName} — subcategories
          </DialogTitle>
        </DialogHeader>

        <Button
          className="rounded-xl font-bold"
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="mr-1 h-4 w-4" />
          Add subcategory
        </Button>

        {isLoading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : data.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            No subcategories yet. Add ones like Cooking Oil, Rice or Dal.
          </p>
        ) : (
          <div className="space-y-2">
            {data.map((s) => (
              <div
                key={s.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-3"
              >
                {s.image_url ? (
                  <StorageImg
                    src={s.image_url}
                    alt={s.name}
                    className="h-11 w-11 rounded-xl object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-secondary text-lg">
                    {s.icon || <Tag className="h-5 w-5 text-muted-foreground" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <span className="truncate">{s.name}</span>
                    {s.is_featured && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    /{s.slug} · order {s.display_order}
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <Switch
                    checked={s.is_active}
                    aria-label={`Toggle ${s.name}`}
                    onCheckedChange={(v) => patch.mutate({ id: s.id, values: { is_active: v } })}
                  />
                  <Button
                    size="icon"
                    variant="ghost"
                    onClick={() => {
                      setEditing(s);
                      setFormOpen(true);
                    }}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="icon" variant="ghost" onClick={() => del.mutate(s.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        <SubcategoryForm
          key={editing?.id ?? "new"}
          open={formOpen}
          onOpenChange={(v) => {
            setFormOpen(v);
            if (!v) setEditing(null);
          }}
          initial={editing}
          saving={save.isPending}
          onSave={(s) => save.mutate(s)}
        />
      </DialogContent>
    </Dialog>
  );
}

function SubcategoryForm({
  open,
  onOpenChange,
  initial,
  onSave,
  saving,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial: Subcategory | null;
  onSave: (s: Partial<Subcategory>) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "");
  const [image, setImage] = useState(initial?.image_url ?? "");
  const [order, setOrder] = useState(initial?.display_order ?? 0);
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [featured, setFeatured] = useState(initial?.is_featured ?? false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit subcategory" : "New subcategory"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs font-bold">Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Cooking Oil" />
          </div>
          <div>
            <Label className="text-xs font-bold">Slug</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={slugifySubcategory(name)}
            />
          </div>
          <ImageInput
            value={image}
            onChange={setImage}
            bucket="categories"
            label="Subcategory image"
            maxEdge={1200}
            required={false}
          />
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs font-bold">Icon (emoji)</Label>
              <Input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder="🛢️" />
            </div>
            <div>
              <Label className="text-xs font-bold">Display order</Label>
              <Input
                type="number"
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
              />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <label className="flex items-center gap-2 text-sm font-semibold">
              <Switch checked={active} onCheckedChange={setActive} /> Active
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold">
              <Switch checked={featured} onCheckedChange={setFeatured} /> Featured
            </label>
          </div>
        </div>
        <DialogFooter>
          <Button
            disabled={!name.trim() || saving}
            className="rounded-xl font-bold"
            onClick={() =>
              onSave({
                name: name.trim(),
                slug: slug.trim() || slugifySubcategory(name),
                icon,
                image_url: image,
                display_order: order,
                is_active: active,
                is_featured: featured,
              })
            }
          >
            {saving ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
