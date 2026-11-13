import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Tag, Layers, Star } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ImageInput } from "@/components/ImageInput";
import { SubcategoryManager } from "@/components/admin/SubcategoryManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { StorageImg } from "@/components/StorageImg";

export const Route = createFileRoute("/admin/categories")({
  head: () => ({
    meta: [
      { title: "Categories & Subcategories — AP Mart Admin" },
      {
        name: "description",
        content:
          "Admin control for the AP Mart category hierarchy: categories, subcategories, images, display order and visibility.",
      },
      { property: "og:title", content: "Categories & Subcategories — AP Mart Admin" },
      {
        property: "og:description",
        content: "Manage the AP Mart category and subcategory hierarchy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Page,
});

type Category = {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  color: string | null;
  display_order: number;
  image_url: string | null;
  is_active: boolean;
  is_featured: boolean;
};

function slugify(s: string) { return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, ""); }

function Page() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Category | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Category | null>(null);
  const [subsFor, setSubsFor] = useState<Category | null>(null);
  const [q, setQ] = useState("");

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-categories"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("*").order("display_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  const save = useMutation({
    mutationFn: async (c: Partial<Category>) => {
      const payload = { ...c, slug: c.slug || slugify(c.name || "") };
      if (editing?.id) {
        const { error } = await supabase.from("categories").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("categories").insert(payload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("Saved"); qc.invalidateQueries({ queryKey: ["admin-categories"] }); setOpen(false); setEditing(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const patch = useMutation({
    mutationFn: async ({ id, values }: { id: string; values: Partial<Category> }) => {
      const { error } = await supabase.from("categories").update(values as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-categories"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-categories"] }); setConfirmDel(null); },
    onError: (e: any) => toast.error(e.message),
  });

  const filtered = data.filter(c => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 px-4 py-4 md:px-6 md:py-6">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <h1 className="large-title">Categories</h1>
          <p className="mt-0.5 text-meta text-muted-foreground">Organise how shoppers browse products.</p>
        </div>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-1" />Add</Button>
          </DialogTrigger>
          <CategoryDialog
            key={editing?.id ?? "new"}
            initial={editing}
            onSave={(c) => save.mutate(c)}
            saving={save.isPending}
          />
        </Dialog>
      </div>

      <Input placeholder="Search categories..." value={q} onChange={(e) => setQ(e.target.value)} />

      {isLoading ? (
        <div className="space-y-3">{[0, 1, 2].map((i) => <div key={i} className="h-20 rounded-xl shimmer" />)}</div>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="rounded-xl border border-border/70 bg-card">
              <div className="flex items-center gap-3 p-3.5">
                {c.image_url ? (
                  <StorageImg src={c.image_url} alt={c.name} className="h-12 w-12 shrink-0 rounded-xl object-cover" loading="lazy" />
                ) : (
                  <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl text-xl" style={{ background: c.color ?? "hsl(var(--secondary))" }}>
                    {c.icon || <Tag className="h-5 w-5" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5 text-subtitle font-semibold">
                    <span className="truncate">{c.name}</span>
                    {c.is_featured && <Star className="h-3.5 w-3.5 shrink-0 fill-primary text-primary" />}
                    {!c.is_active && <span className="shrink-0 text-caption font-medium text-muted-foreground">Hidden</span>}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">/{c.slug} · order {c.display_order}</div>
                </div>
                <Switch
                  checked={c.is_active}
                  aria-label={`Toggle ${c.name}`}
                  onCheckedChange={(v) => patch.mutate({ id: c.id, values: { is_active: v } })}
                />
              </div>
              <div className="flex items-center gap-1 border-t border-border/60 px-2 py-1.5">
                <Button size="sm" variant="ghost" className="text-primary" onClick={() => setSubsFor(c)}>
                  <Layers className="mr-1 h-4 w-4" />Subcategories
                </Button>
                <Link to="/admin/products" search={{ cat: c.id }} className="px-2 text-meta font-semibold text-primary">
                  Products
                </Link>
                <div className="flex-1" />
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setConfirmDel(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <div className="col-span-full rounded-xl border border-border/70 bg-card px-6 py-10 text-center"><div className="text-subtitle font-semibold">No categories</div><p className="mt-0.5 text-meta text-muted-foreground">Add your first category to get started.</p></div>}
        </div>
      )}

      {subsFor && (
        <SubcategoryManager
          categoryId={subsFor.id}
          categoryName={subsFor.name}
          open={!!subsFor}
          onOpenChange={(v) => !v && setSubsFor(null)}
        />
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete category?</AlertDialogTitle>
            <AlertDialogDescription>"{confirmDel?.name}" and its subcategories will be permanently removed.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && del.mutate(confirmDel.id)}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryDialog({ initial, onSave, saving }: { initial: Category | null; onSave: (c: Partial<Category>) => void; saving: boolean }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [icon, setIcon] = useState(initial?.icon ?? "");
  const [color, setColor] = useState(initial?.color ?? "#dcfce7");
  const [order, setOrder] = useState(initial?.display_order ?? 0);
  const [image, setImage] = useState(initial?.image_url ?? "");
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [featured, setFeatured] = useState(initial?.is_featured ?? false);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label className="text-meta font-medium">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label className="text-meta font-medium">Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugify(name)} /></div>
        <ImageInput value={image} onChange={setImage} bucket="categories" label="Category banner / image" required={false} />
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-meta font-medium">Icon (emoji)</Label><Input value={icon} onChange={(e) => setIcon(e.target.value)} /></div>
          <div><Label className="text-meta font-medium">Color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></div>
        </div>
        <div><Label className="text-meta font-medium">Display order</Label><Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} /></div>
        <div className="flex items-center gap-6">
          <label className="flex items-center gap-2 text-body font-medium">
            <Switch checked={active} onCheckedChange={setActive} /> Active
          </label>
          <label className="flex items-center gap-2 text-body font-medium">
            <Switch checked={featured} onCheckedChange={setFeatured} /> Featured
          </label>
        </div>
      </div>
      <DialogFooter>
        <Button disabled={!name || saving} onClick={() => onSave({ name, slug: slug || slugify(name), icon: icon || null, color, display_order: order, image_url: image || null, is_active: active, is_featured: featured })}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
