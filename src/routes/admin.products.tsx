import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Package, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { rupees } from "@/lib/format";
import { ImageInput } from "@/components/ImageInput";
import { MultiCategorySelect } from "@/components/MultiCategorySelect";
import {
  MAX_PRODUCT_CATEGORIES,
  loadProductCategories,
  loadProductCategoriesMap,
  saveProductCategories,
} from "@/lib/productCategories";
import { StorageImg } from "@/components/StorageImg";

const searchSchema = z.object({ filter: z.string().optional(), cat: z.string().optional() });

export const Route = createFileRoute("/admin/products")({
  head: () => ({ meta: [{ title: "Products — Admin" }] }),
  validateSearch: searchSchema,
  component: Page,
});

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  category_id: string | null;
  price: number;
  mrp: number;
  unit: string;
  stock: number;
  brand: string | null;
  is_available: boolean;
  is_featured: boolean;
  is_bestseller: boolean;
};
type Category = { id: string; name: string };

function slugify(s: string) {
  return s
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}
const LOW_STOCK = 5;

function Page() {
  const { filter, cat } = useSearch({ from: "/admin/products" });
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<Product | null>(null);
  const [q, setQ] = useState("");
  const [catFilter, setCatFilter] = useState<string>(cat ?? "all");

  const { data = [], isLoading } = useQuery({
    queryKey: ["admin-products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Product[];
    },
  });

  useEffect(() => {
    const channel = supabase
      .channel("admin-products-images")
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => {
        qc.invalidateQueries({ queryKey: ["admin-products"], refetchType: "active" });
      })
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc]);

  const { data: cats = [] } = useQuery({
    queryKey: ["admin-cats-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("categories").select("id, name").order("name");
      if (error) throw error;
      return data as Category[];
    },
  });

  const { data: catMap = {} } = useQuery({
    queryKey: ["admin-product-categories"],
    enabled: data.length > 0,
    queryFn: () => loadProductCategoriesMap(data.map((p) => p.id)),
  });

  const save = useMutation({
    mutationFn: async ({ categoryIds, ...p }: Partial<Product> & { categoryIds: string[] }) => {
      const payload = { ...p, slug: p.slug || slugify(p.name || "") };
      if (editing?.id) {
        const { error } = await supabase.from("products").update(payload).eq("id", editing.id);
        if (error) throw error;
        await saveProductCategories(editing.id, categoryIds);
      } else {
        const { data: row, error } = await supabase
          .from("products")
          .insert(payload as any)
          .select("id")
          .single();
        if (error) throw error;
        await saveProductCategories(row.id, categoryIds);
      }
    },
    onSuccess: () => {
      toast.success("Saved");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      qc.invalidateQueries({ queryKey: ["admin-product-categories"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e) => toast.error(e.message),
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin-products"] });
      setConfirmDel(null);
    },
    onError: (e) => toast.error(e.message),
  });

  let filtered = data.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));
  if (catFilter !== "all")
    filtered = filtered.filter(
      (p) => p.category_id === catFilter || (catMap[p.id] ?? []).includes(catFilter),
    );
  if (filter === "low-stock") filtered = filtered.filter((p) => p.stock <= LOW_STOCK);

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-4 md:px-6 md:py-6">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <h1 className="large-title">Products</h1>
          <p className="mt-1 flex items-center gap-2 text-body text-muted-foreground">
            Catalogue and stock across the marketplace
            {filter === "low-stock" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-tint-rose px-2.5 py-0.5 text-caption font-semibold text-[oklch(0.45_0.12_15)]">
                <AlertTriangle className="h-3 w-3" />
                Low stock
              </span>
            )}
          </p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(v) => {
            setOpen(v);
            if (!v) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button onClick={() => setEditing(null)}>
              <Plus className="h-4 w-4 mr-1" />
              Add
            </Button>
          </DialogTrigger>
          <ProductDialog
            initial={editing}
            categories={cats}
            onSave={(p) => save.mutate(p)}
            saving={save.isPending}
          />
        </Dialog>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder="Search products"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          className="flex-1"
        />
        <Select value={catFilter} onValueChange={setCatFilter}>
          <SelectTrigger className="h-11 rounded-xl border-0 bg-secondary sm:w-56">
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All categories</SelectItem>
            {cats.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-36 rounded-xl shimmer" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:gap-4 lg:grid-cols-3">
          {filtered.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-xl border border-border/70 bg-card">
              <div className="flex gap-3.5 p-4">
                <div className="grid h-20 w-20 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary">
                  {p.image_url ? (
                    <StorageImg
                      loading="lazy"
                      decoding="async"
                      src={p.image_url}
                      alt={p.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <Package className="h-6 w-6 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="truncate text-subtitle font-semibold">{p.name}</div>
                  <div className="truncate text-small text-muted-foreground">
                    {p.unit} · {p.brand ?? "—"}
                  </div>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="font-semibold">{rupees(p.price)}</span>
                    {p.mrp > p.price && (
                      <span className="text-xs line-through text-muted-foreground">
                        {rupees(p.mrp)}
                      </span>
                    )}
                  </div>
                  <div
                    className={`mt-1 text-small ${p.stock <= LOW_STOCK ? "font-semibold text-destructive" : "text-muted-foreground"}`}
                  >
                    Stock: {p.stock}
                  </div>
                </div>
              </div>
              <div className="flex border-t border-border/70">
                <button
                  onClick={() => {
                    setEditing(p);
                    setOpen(true);
                  }}
                  className="press flex flex-1 items-center justify-center gap-1.5 py-3 text-body font-medium hover:bg-secondary/60"
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </button>
                <button
                  onClick={() => setConfirmDel(p)}
                  className="press flex flex-1 items-center justify-center gap-1.5 border-l border-border/70 py-3 text-body font-medium text-destructive hover:bg-secondary/60"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-full rounded-xl border border-border/70 bg-card px-6 py-10 text-center">
              <div className="text-subtitle font-semibold">No products found</div>
              <p className="mt-0.5 text-meta text-muted-foreground">
                Try a different search or category.
              </p>
            </div>
          )}
        </div>
      )}

      <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete product?</AlertDialogTitle>
            <AlertDialogDescription>
              "{confirmDel?.name}" will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDel && del.mutate(confirmDel.id)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function ProductDialog({
  initial,
  categories,
  onSave,
  saving,
}: {
  initial: Product | null;
  categories: Category[];
  onSave: (p: Partial<Product> & { categoryIds: string[] }) => void;
  saving: boolean;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [slug, setSlug] = useState(initial?.slug ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [imageUrl, setImageUrl] = useState(initial?.image_url ?? "");
  const [categoryIds, setCategoryIds] = useState<string[]>(
    initial?.category_id ? [initial.category_id] : [],
  );

  useEffect(() => {
    if (!initial?.id) return;
    loadProductCategories(initial.id, initial.category_id)
      .then((ids) => {
        if (ids.length > 0) setCategoryIds(ids);
      })
      .catch(() => {});
  }, [initial?.id, initial?.category_id]);
  const [price, setPrice] = useState(initial?.price ?? 0);
  const [mrp, setMrp] = useState(initial?.mrp ?? 0);
  const [unit, setUnit] = useState(initial?.unit ?? "1 pc");
  const [stock, setStock] = useState(initial?.stock ?? 0);
  const [brand, setBrand] = useState(initial?.brand ?? "");
  const [available, setAvailable] = useState(initial?.is_available ?? true);
  const [featured, setFeatured] = useState(initial?.is_featured ?? false);
  const [bestseller, setBestseller] = useState(initial?.is_bestseller ?? false);

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader>
        <DialogTitle>{initial ? "Edit product" : "New product"}</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div>
          <label className="text-meta font-medium">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-meta font-medium">Slug</label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder={slugify(name)}
            />
          </div>
          <div>
            <label className="text-meta font-medium">Brand</label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-meta font-medium">Categories</label>
          <MultiCategorySelect
            options={categories}
            value={categoryIds}
            onChange={setCategoryIds}
            max={MAX_PRODUCT_CATEGORIES}
          />
        </div>
        <div>
          <label className="text-meta font-medium">Description</label>
          <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
        </div>
        <ImageInput
          value={imageUrl}
          onChange={setImageUrl}
          bucket="product-images"
          label="Product image"
          required
        />
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-meta font-medium">Price ₹</label>
            <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-meta font-medium">MRP ₹</label>
            <Input type="number" value={mrp} onChange={(e) => setMrp(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-meta font-medium">Stock</label>
            <Input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
          </div>
        </div>
        <div>
          <label className="text-meta font-medium">Unit (e.g. 500g, 1L)</label>
          <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-4 pt-2">
          <label className="flex items-center gap-2 text-body">
            <Switch checked={available} onCheckedChange={setAvailable} />
            Available
          </label>
          <label className="flex items-center gap-2 text-body">
            <Switch checked={featured} onCheckedChange={setFeatured} />
            Featured
          </label>
          <label className="flex items-center gap-2 text-body">
            <Switch checked={bestseller} onCheckedChange={setBestseller} />
            Bestseller
          </label>
        </div>
      </div>
      <DialogFooter>
        <Button
          disabled={!name || categoryIds.length === 0 || !imageUrl || saving}
          onClick={() =>
            onSave({
              name,
              slug: slug || slugify(name),
              description,
              image_url: imageUrl,
              category_id: categoryIds[0] ?? null,
              categoryIds,
              price,
              mrp: mrp || price,
              unit,
              stock,
              brand,
              is_available: available,
              is_featured: featured,
              is_bestseller: bestseller,
            })
          }
        >
          {saving ? "Saving..." : "Save"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
