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
    <div className="p-4 max-w-5xl mx-auto space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-xl font-display font-extrabold flex-1">Categories</h1>
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
        <p className="text-muted-foreground">Loading...</p>
      ) : (
        <div className="grid grid-cols-1 gap-3">
          {filtered.map((c) => (
            <div key={c.id} className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-3">
              {c.image_url ? (
                <StorageImg src={c.image_url} alt={c.name} className="h-12 w-12 rounded-xl object-cover" loading="lazy" />
              ) : (
                <div className="grid h-12 w-12 place-items-center rounded-xl text-xl" style={{ background: c.color ?? "hsl(var(--secondary))" }}>
                  {c.icon ?? <Tag className="h-5 w-5" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-bold truncate flex items-center gap-1.5">
                  {c.name}
                  {c.is_featured && <Star className="h-3.5 w-3.5 fill-primary text-primary" />}
                  {!c.is_active && <span className="text-[10px] font-bold text-muted-foreground">(hidden)</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">/{c.slug} · order {c.display_order}</div>
              </div>
              <Switch
                checked={c.is_active}
                aria-label={`Toggle ${c.name}`}
                onCheckedChange={(v) => patch.mutate({ id: c.id, values: { is_active: v } })}
              />
              <Button size="sm" variant="outline" className="rounded-xl font-bold" onClick={() => setSubsFor(c)}>
                <Layers className="h-4 w-4 mr-1" />Subcategories
              </Button>
              <Link to="/admin/products" search={{ cat: c.id }} className="text-xs font-semibold text-primary underline-offset-2 hover:underline">
                View products
              </Link>
              <Button size="icon" variant="ghost" onClick={() => { setEditing(c); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => setConfirmDel(c)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-muted-foreground col-span-full text-center py-8">No categories.</p>}
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
  const [icon, setIcon] = useState(initial?.icon ?? "🛒");
  const [color, setColor] = useState(initial?.color ?? "#dcfce7");
  const [order, setOrder] = useState(initial?.display_order ?? 0);
  const [image, setImage] = useState(initial?.image_url ?? "");
  const [active, setActive] = useState(initial?.is_active ?? true);
  const [featured, setFeatured] = useState(initial?.is_featured ?? false);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>{initial ? "Edit category" : "New category"}</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <div><Label className="text-xs font-bold">Name</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
        <div><Label className="text-xs font-bold">Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} placeholder={slugify(name)} /></div>
        <ImageInput value={image} onChange={setImage} bucket="categories" label="Category banner / image" required={false} />
        <div className="grid grid-cols-2 gap-3">
          <div><Label className="text-xs font-bold">Icon (emoji)</Label><Input value={icon} onChange={(e) => setIcon(e.target.value)} /></div>
          <div><Label className="text-xs font-bold">Color</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></div>
        </div>
        <div><Label className="text-xs font-bold">Display order</Label><Input type="number" value={order} onChange={(e) => setOrder(Number(e.target.value))} /></div>
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
        <Button disabled={!name || saving} onClick={() => onSave({ name, slug: slug || slugify(name), icon, color, display_order: order, image_url: image || null, is_active: active, is_featured: featured })}>
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
