import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Package, Search, BarChart3, Library, AlertCircle } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { RoleShell } from "@/components/RoleShell";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
import { MultiImageInput } from "@/components/MultiImageInput";
import { MultiCategorySelect } from "@/components/MultiCategorySelect";
import { loadProductSubcategories, saveProductSubcategories, anyCategoryHasSubcategories } from "@/lib/productSubcategories";
import { SubcategorySelect } from "@/components/SubcategorySelect";
import { MAX_PRODUCT_CATEGORIES, loadProductCategories, saveProductCategories } from "@/lib/productCategories";
import { VariantsEditor, type VariantDraft } from "@/components/VariantsEditor";
import { loadVariants, rowToDraft, saveVariants } from "@/lib/variants";
import { rupees } from "@/lib/format";
import { expiryStatus } from "@/lib/expiry";
import { DateRangeFields, dateRangeError } from "@/components/DateRangeFields";
import { CatalogDialogContent } from "@/components/CatalogBrowser";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { SHOPKEEPER_NAV } from "./shopkeeper.dashboard";
import { StorageImg } from "@/components/StorageImg";


export const Route = createFileRoute("/shopkeeper/products")({
  head: () => ({ meta: [{ title: "Products — Shopkeeper" }] }),
  component: Page,
});

type ShopProduct = {
  id: string;
  price: number;
  stock: number;
  is_available: boolean;
  product_id: string;
  manufacturing_date: string | null;
  expiry_date: string | null;

  products: {
    id: string;
    name: string;
    unit: string;
    image_url: string | null;
    cover_image: string | null;
    image_gallery: string[] | null;
    mrp: number;
    price: number;
    description: string | null;
    brand: string | null;
    category_id: string | null;
    subcategory_id: string | null;
  } | null;
};

type Category = { id: string; name: string };

function slugify(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function Page() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [shopId, setShopId] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<ShopProduct | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [confirmDel, setConfirmDel] = useState<ShopProduct | null>(null);

  useEffect(() => {
    if (!user) return;
    supabase.from("shops").select("id").eq("owner_id", user.id).maybeSingle().then(({ data }) => setShopId(data?.id ?? null));
  }, [user]);

  useEffect(() => {
    if (!shopId) return;
    const invalidateShopProducts = () => {
      qc.invalidateQueries({ queryKey: ["shop-products", shopId], refetchType: "active" });
    };
    const channel = supabase
      .channel(`shop-products-images-${shopId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "products" }, invalidateShopProducts)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "shop_products",
        filter: `shop_id=eq.${shopId}`,
      }, invalidateShopProducts)
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [qc, shopId]);

  const items = useQuery({
    queryKey: ["shop-products", shopId],
    queryFn: async () => {
      if (!shopId) return [] as ShopProduct[];
      const { data, error } = await supabase
        .from("shop_products")
        .select("id, price, stock, is_available, product_id, manufacturing_date, expiry_date, products(id, name, unit, image_url, cover_image, image_gallery, mrp, price, description, brand, category_id, subcategory_id)")
        .eq("shop_id", shopId)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data ?? []) as any as ShopProduct[];
    },
    enabled: !!shopId,
  });

  const cats = useQuery({
    queryKey: ["shop-cats-list"],
    queryFn: async () => {
      const { data } = await supabase.from("categories").select("id, name").order("name");
      return (data ?? []) as Category[];
    },
  });

  const filtered = useMemo(() => {
    const list = items.data ?? [];
    if (!q.trim()) return list;
    return list.filter((sp) => sp.products?.name?.toLowerCase().includes(q.toLowerCase()));
  }, [items.data, q]);

  const refresh = () => qc.invalidateQueries({ queryKey: ["shop-products", shopId] });

  async function handleDelete(sp: ShopProduct) {
    const { error } = await supabase.from("shop_products").delete().eq("id", sp.id);
    if (error) return toast.error(error.message);
    toast.success("Removed from inventory");
    setConfirmDel(null);
    refresh();
  }

  return (
    <RoleShell role="shopkeeper" nav={SHOPKEEPER_NAV} requireRoles={["shopkeeper", "admin"]}>
      <div className="p-4 md:p-6 max-w-6xl mx-auto">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <h1 className="font-display text-3xl font-extrabold flex-1">Inventory</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {shopId && (
              <>
                <Dialog open={catalogOpen} onOpenChange={setCatalogOpen}>
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <DialogTrigger asChild>
                          <Button variant="outline" className="gap-1 bg-card">
                            <Library className="h-4 w-4" />
                            Add from Catalog
                          </Button>
                        </DialogTrigger>
                      </TooltipTrigger>
                      <TooltipContent>Add an existing AP Mart product to your shop.</TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                  <CatalogDialogContent
                    shopId={shopId}
                    categories={cats.data ?? []}
                    onDone={() => { setCatalogOpen(false); refresh(); }}
                  />
                </Dialog>
                <Dialog open={addOpen} onOpenChange={setAddOpen}>
                  <DialogTrigger asChild>
                    <Button className="gap-1"><Plus className="h-4 w-4" />Add Product</Button>
                  </DialogTrigger>
                  <AddProductDialog
                    shopId={shopId}
                    categories={cats.data ?? []}
                    onOpenCatalog={() => { setAddOpen(false); setCatalogOpen(true); }}
                    onDone={() => { setAddOpen(false); refresh(); }}
                  />
                </Dialog>
              </>
            )}
            <Button asChild variant="outline" size="sm" className="gap-1 sm:ml-2">
              <Link to="/shopkeeper/inventory-insights"><BarChart3 className="h-4 w-4" />Insights</Link>
            </Button>
          </div>
        </div>

        {!shopId ? (
          <p className="mt-6 text-sm text-muted-foreground">No shop assigned to your account.</p>
        ) : (
          <>
            <div className="mt-4 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search your inventory..." className="pl-9" />
            </div>

            {items.isLoading ? (
              <p className="mt-6 text-muted-foreground">Loading...</p>
            ) : filtered.length === 0 ? (
              <p className="mt-6 text-muted-foreground text-center py-10">
                {q ? "No matches." : "No products yet. Tap Add product to get started."}
              </p>
            ) : (
              <div className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {filtered.map((sp) => (
                  <div key={sp.id} className="rounded-2xl border border-border bg-card overflow-hidden">
                    <div className="flex gap-3 p-3">
                      {sp.products?.image_url ? (
                        <StorageImg loading="lazy" decoding="async" src={sp.products.image_url} alt={sp.products.name} className="h-16 w-16 rounded-xl object-cover" />
                      ) : (
                        <div className="h-16 w-16 rounded-xl bg-secondary grid place-items-center"><Package className="h-5 w-5 text-muted-foreground" /></div>
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{sp.products?.name ?? "—"}</div>
                        <div className="text-xs text-muted-foreground">{sp.products?.unit}</div>
                        <div className="mt-1 flex items-center gap-2 text-sm flex-wrap">
                          <span className="font-bold text-primary">{rupees(sp.price)}</span>
                          <span className={`text-xs ${sp.stock <= 5 ? "text-destructive font-bold" : "text-muted-foreground"}`}>
                            Stock: {sp.stock}
                          </span>
                          {!sp.is_available && <span className="text-xs bg-muted px-2 rounded-full">Hidden</span>}
                        </div>
                        {(() => {
                          const st = expiryStatus(sp.expiry_date, sp.manufacturing_date);
                          if (st.status === "none") return null;
                          return (
                            <div className="mt-1 flex flex-wrap gap-1">
                              <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${st.color}`}>
                                {st.emoji} {st.statusLabel}
                              </span>
                            </div>
                          );
                        })()}
                      </div>
                    </div>

                    <div className="flex border-t border-border">
                      <button onClick={() => { setEditing(sp); setEditOpen(true); }} className="flex-1 flex items-center justify-center gap-1 py-2 text-sm font-semibold hover:bg-secondary">
                        <Pencil className="h-4 w-4" />Edit
                      </button>
                      <button onClick={() => setConfirmDel(sp)} className="flex-1 flex items-center justify-center gap-1 py-2 text-sm font-semibold text-destructive hover:bg-secondary border-l border-border">
                        <Trash2 className="h-4 w-4" />Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        <Dialog open={editOpen} onOpenChange={(v) => { setEditOpen(v); if (!v) setEditing(null); }}>
          {editing && (
            <EditDialog
              item={editing}
              categories={cats.data ?? []}
              onSaved={() => { setEditOpen(false); setEditing(null); refresh(); }}
            />
          )}
        </Dialog>

        <AlertDialog open={!!confirmDel} onOpenChange={(v) => !v && setConfirmDel(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove from inventory?</AlertDialogTitle>
              <AlertDialogDescription>"{confirmDel?.products?.name}" will no longer be sold by your shop.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => confirmDel && handleDelete(confirmDel)}>Remove</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </RoleShell>
  );
}

function EditDialog({
  item, categories, onSaved,
}: { item: ShopProduct; categories: Category[]; onSaved: () => void }) {
  // shop_products fields
  const [price, setPrice] = useState(item.price);
  const [stock, setStock] = useState(item.stock);
  const [available, setAvailable] = useState(item.is_available);
  // products fields
  const [name, setName] = useState(item.products?.name ?? "");
  const [unit, setUnit] = useState(item.products?.unit ?? "1 pc");
  const [brand, setBrand] = useState(item.products?.brand ?? "");
  const [description, setDescription] = useState(item.products?.description ?? "");
  const [mrp, setMrp] = useState(item.products?.mrp ?? 0);
  const [categoryIds, setCategoryIds] = useState<string[]>(
    item.products?.category_id ? [item.products.category_id] : [],
  );
  const [subcategoryIds, setSubcategoryIds] = useState<string[]>(
    item.products?.subcategory_id ? [item.products.subcategory_id] : [],
  );
  const initialGallery = (item.products?.image_gallery && item.products.image_gallery.length > 0)
    ? item.products.image_gallery
    : (item.products?.cover_image ? [item.products.cover_image] : (item.products?.image_url ? [item.products.image_url] : []));
  const [gallery, setGallery] = useState<string[]>(initialGallery);
  const [mfgDate, setMfgDate] = useState<string>(item.manufacturing_date ?? "");
  const [expDate, setExpDate] = useState<string>(item.expiry_date ?? "");
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [saving, setSaving] = useState(false);


  useEffect(() => {
    if (!item.product_id) return;
    loadVariants(item.product_id).then((rows) => setVariants(rows.map(rowToDraft))).catch(() => {});
    loadProductCategories(item.product_id, item.products?.category_id ?? null)
      .then((ids) => { if (ids.length > 0) setCategoryIds(ids); })
      .catch(() => {});
    loadProductSubcategories(item.product_id, item.products?.subcategory_id ?? null)
      .then((ids) => { if (ids.length > 0) setSubcategoryIds(ids); })
      .catch(() => {});
  }, [item.product_id, item.products?.category_id]);

  async function save() {
    if (categoryIds.length === 0) { toast.error("Select at least one category"); return; }
    if (subcategoryIds.length === 0 && await anyCategoryHasSubcategories(categoryIds)) {
      toast.error("Select at least one subcategory");
      return;
    }
    const dErr = dateRangeError(mfgDate, expDate);
    if (dErr) { toast.error(dErr); return; }
    setSaving(true);
    try {
      if (item.product_id) {
        const { error: pErr } = await supabase
          .from("products")
          .update({
            name, unit, brand, description, mrp: mrp || price,
            image_url: gallery[0] ?? null,
            cover_image: gallery[0] ?? null,
            image_gallery: gallery,
            category_id: categoryIds[0] ?? null,
            subcategory_id: subcategoryIds[0] ?? null,
          } as any)
          .eq("id", item.product_id);
        if (pErr) throw pErr;
        await saveProductCategories(item.product_id, categoryIds);
        await saveProductSubcategories(item.product_id, subcategoryIds);
        await saveVariants(item.product_id, variants);
      }
      // Update shop_products
      const { error } = await supabase
        .from("shop_products")
        .update({
          price,
          stock,
          is_available: available,
          manufacturing_date: mfgDate || null,
          expiry_date: expDate || null,
        } as any)
        .eq("id", item.id);
      if (error) throw error;

      toast.success("Updated");
      onSaved();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to update");
    } finally {
      setSaving(false);
    }
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit product</DialogTitle></DialogHeader>
      <div className="space-y-3">
        <MultiImageInput value={gallery} onChange={setGallery} label="Product images" required />
        <div>
          <label className="text-xs font-bold">Name</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs font-bold">Brand</label>
            <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
          </div>
          <div>
            <label className="text-xs font-bold">Unit (e.g. 500g)</label>
            <Input value={unit} onChange={(e) => setUnit(e.target.value)} />
          </div>
        </div>
        <div>
          <label className="text-xs font-bold">Categories <span className="text-destructive">*</span></label>
          <MultiCategorySelect
            options={categories}
            value={categoryIds}
            onChange={setCategoryIds}
            max={MAX_PRODUCT_CATEGORIES}
          />
        </div>
        <SubcategorySelect
          categoryIds={categoryIds}
          categories={categories}
          value={subcategoryIds}
          onChange={setSubcategoryIds}
          required
        />

        <div>
          <label className="text-xs font-bold">Description</label>
          <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div className="pt-2 border-t border-border">
          <VariantsEditor variants={variants} onChange={setVariants} />
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-xs font-bold">Your price ₹</label>
            <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-bold">MRP ₹</label>
            <Input type="number" value={mrp} onChange={(e) => setMrp(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-xs font-bold">Stock</label>
            <Input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
          </div>
        </div>
        <DateRangeFields
          mfg={mfgDate} exp={expDate}
          onMfg={setMfgDate} onExp={setExpDate}
        />
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={available} onCheckedChange={setAvailable} />Available to customers
        </label>

      </div>
      <DialogFooter>
        <Button disabled={saving || !name || gallery.length === 0} onClick={save}>{saving ? "Saving..." : "Save"}</Button>
      </DialogFooter>
    </DialogContent>
  );
}

function AddProductDialog({
  shopId, categories, onOpenCatalog, onDone,
}: { shopId: string; categories: Category[]; onOpenCatalog: () => void; onDone: () => void }) {
  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Add a new product</DialogTitle></DialogHeader>
      <CreateNewProduct
        shopId={shopId}
        categories={categories}
        onOpenCatalog={onOpenCatalog}
        onDone={onDone}
      />
    </DialogContent>
  );
}

function CreateNewProduct({
  shopId, categories, onOpenCatalog, onDone,
}: { shopId: string; categories: Category[]; onOpenCatalog: () => void; onDone: () => void }) {
  const [productType, setProductType] = useState<"simple" | "variants">("simple");
  const [name, setName] = useState("");
  const [brand, setBrand] = useState("");
  const [unit, setUnit] = useState("1 pc");
  const [description, setDescription] = useState("");
  const [categoryIds, setCategoryIds] = useState<string[]>([]);
  const [subcategoryIds, setSubcategoryIds] = useState<string[]>([]);
  const [gallery, setGallery] = useState<string[]>([]);
  const [price, setPrice] = useState<number>(0);
  const [mrp, setMrp] = useState<number>(0);
  const [stock, setStock] = useState<number>(0);
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [mfgDate, setMfgDate] = useState<string>("");
  const [expDate, setExpDate] = useState<string>("");
  const [saving, setSaving] = useState(false);

  // ---- Smart duplicate detection against the AP Mart master catalog ----
  const debouncedName = useDebouncedValue(name.trim(), 300);
  const dup = useQuery({
    queryKey: ["catalog-duplicate", debouncedName, shopId],
    enabled: debouncedName.length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("find_catalog_duplicate", {
        _name: debouncedName,
        _shop_id: shopId,
      });
      if (error) throw error;
      const row = ((data ?? []) as any[])[0];
      return (row ?? null) as { id: string; name: string; brand: string | null; unit: string | null; already_added: boolean } | null;
    },
  });
  const duplicate = debouncedName.length >= 2 ? (dup.data ?? null) : null;

  async function save() {
    if (duplicate) return toast.error("This product already exists in AP Mart. Use \"Add from Catalog\" instead.");
    if (!name.trim()) return toast.error("Product name is required");
    if (categoryIds.length === 0) return toast.error("Select at least one category");

    const activeVariants = variants.filter((v) => !v._deleted);

    if (productType === "simple") {
      if (gallery.length === 0) return toast.error("Upload at least 1 product image");
      if (!unit.trim()) return toast.error("Unit is required");
      if (!(price > 0)) return toast.error("Price must be greater than 0");
      if (stock < 0) return toast.error("Stock cannot be negative");
    } else {
      if (activeVariants.length === 0) return toast.error("Add at least 1 variant");
      for (const v of activeVariants) {
        const vLabel = v.name || v.size || "Variant";
        if (!v.name.trim() && !v.size.trim()) return toast.error("Every variant needs a name");
        if (!v.unit.trim()) return toast.error(`Variant "${vLabel}" needs a unit`);
        if (!(v.selling_price > 0)) return toast.error(`Variant "${vLabel}" needs a price`);
        if (v.stock < 0) return toast.error(`Variant "${vLabel}" has invalid stock`);
        if (!v.images || v.images.length === 0) return toast.error(`Variant "${vLabel}" needs at least 1 image`);
        if (v.images.length > 6) return toast.error(`Variant "${vLabel}" can have at most 6 images`);
      }
    }

    if (subcategoryIds.length === 0 && await anyCategoryHasSubcategories(categoryIds)) {
      toast.error("Select at least one subcategory");
      return;
    }
    const dErr = dateRangeError(mfgDate, expDate);
    if (dErr) { toast.error(dErr); return; }

    setSaving(true);
    try {
      const slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 7)}`;
      const isVariantMode = productType === "variants";
      const defaultV = isVariantMode
        ? (activeVariants.find((v) => v.is_default) ?? activeVariants[0])
        : null;
      const basePrice = isVariantMode ? (defaultV?.selling_price ?? 0) : price;
      const baseMrp = isVariantMode ? (defaultV?.mrp || defaultV?.selling_price || 0) : (mrp || price);
      const baseUnit = isVariantMode ? (defaultV?.unit || defaultV?.size || "1 pc") : unit;

      const { data: prod, error: pErr } = await supabase
        .from("products")
        .insert({
          name, slug, description,
          image_url: gallery[0] ?? null,
          cover_image: gallery[0] ?? null,
          image_gallery: gallery,
          category_id: categoryIds[0], subcategory_id: subcategoryIds[0] ?? null, brand, unit: baseUnit,
          price: basePrice, mrp: baseMrp, stock: 0,
          is_available: true,
        })
        .select("id")
        .single();
      if (pErr) throw pErr;

      await saveProductCategories(prod.id, categoryIds);
      await saveProductSubcategories(prod.id, subcategoryIds);

      const shopStock = isVariantMode
        ? activeVariants.reduce((s, v) => s + (Number(v.stock) || 0), 0)
        : stock;

      const { error: sErr } = await supabase.from("shop_products").insert({
        shop_id: shopId,
        product_id: prod.id,
        price: basePrice,
        stock: shopStock,
        is_available: true,
        manufacturing_date: mfgDate || null,
        expiry_date: expDate || null,
      } as any);
      if (sErr) throw sErr;

      if (isVariantMode) {
        await saveVariants(prod.id, variants);
      }
      toast.success("Product created");
      onDone();
    } catch (e: any) {
      toast.error(e.message ?? "Failed to create");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative">
      <div className="space-y-4 pb-20">
        <div className="rounded-2xl border border-border bg-secondary/40 p-3">
          <div className="text-xs font-bold text-muted-foreground mb-2 uppercase tracking-wide">Product Type</div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setProductType("simple")}
              className={`rounded-xl border p-3 text-left transition ${
                productType === "simple"
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border bg-card hover:bg-secondary"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-4 w-4 rounded-full border-2 grid place-items-center ${productType === "simple" ? "border-primary" : "border-muted-foreground"}`}>
                  {productType === "simple" && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                <span className="font-bold text-sm">Simple Product</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 ml-6">One price, one stock</p>
            </button>
            <button
              type="button"
              onClick={() => setProductType("variants")}
              className={`rounded-xl border p-3 text-left transition ${
                productType === "variants"
                  ? "border-primary bg-primary/10 ring-2 ring-primary/30"
                  : "border-border bg-card hover:bg-secondary"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`h-4 w-4 rounded-full border-2 grid place-items-center ${productType === "variants" ? "border-primary" : "border-muted-foreground"}`}>
                  {productType === "variants" && <span className="h-2 w-2 rounded-full bg-primary" />}
                </span>
                <span className="font-bold text-sm">With Variants</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-1 ml-6">e.g. 500 ml, 1 L, 1 kg</p>
            </button>
          </div>
        </div>

        {productType === "simple" && (
          <div className="rounded-2xl border border-border bg-card p-3">
            <MultiImageInput value={gallery} onChange={setGallery} label="Product images (1–6)" required />
          </div>
        )}

        <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
          <div>
            <label className="text-xs font-bold">Name <span className="text-destructive">*</span></label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Amul Gold Milk" />
            {duplicate && (
              <div className="mt-2 rounded-xl border border-primary/40 bg-primary/10 p-3">
                <p className="text-sm font-semibold flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                  {duplicate.already_added
                    ? `${duplicate.name} has already been added to your shop.`
                    : `This product already exists in AP Mart. Please use "Add from Catalog" instead.`}
                </p>
                <p className="text-xs text-muted-foreground mt-1 ml-6">
                  Match: {duplicate.name}{duplicate.unit ? ` · ${duplicate.unit}` : ""}{duplicate.brand ? ` · ${duplicate.brand}` : ""}
                </p>
                {!duplicate.already_added && (
                  <div className="mt-2 flex gap-2 ml-6">
                    <Button size="sm" onClick={onOpenCatalog} className="gap-1">
                      <Library className="h-4 w-4" />Open Catalog
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-bold">Brand</label>
              <Input value={brand} onChange={(e) => setBrand(e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-bold">Categories <span className="text-destructive">*</span></label>
            <MultiCategorySelect
              options={categories}
              value={categoryIds}
              onChange={setCategoryIds}
              max={MAX_PRODUCT_CATEGORIES}
            />
          </div>
          <SubcategorySelect
            categoryIds={categoryIds}
            categories={categories}
            value={subcategoryIds}
            onChange={setSubcategoryIds}
            required
          />

          <div>
            <label className="text-xs font-bold">Description</label>
            <Textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
        </div>

        {productType === "simple" && (
          <div className="rounded-2xl border border-border bg-card p-3 space-y-3">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Pricing &amp; stock</div>
            <div>
              <label className="text-xs font-bold">Unit <span className="text-destructive">*</span></label>
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="500g, 1L, 1 pc" />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="text-xs font-bold">Price ₹ <span className="text-destructive">*</span></label>
                <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs font-bold">MRP ₹</label>
                <Input type="number" value={mrp} onChange={(e) => setMrp(Number(e.target.value))} />
              </div>
              <div>
                <label className="text-xs font-bold">Stock <span className="text-destructive">*</span></label>
                <Input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
              </div>
            </div>
            <DateRangeFields mfg={mfgDate} exp={expDate} onMfg={setMfgDate} onExp={setExpDate} />
          </div>
        )}

        {productType === "variants" && (
          <div className="rounded-2xl border border-border bg-card p-3">
            <VariantsEditor variants={variants} onChange={setVariants} />
          </div>
        )}
      </div>

      <div className="sticky bottom-0 left-0 right-0 -mx-6 px-6 py-3 bg-background/95 backdrop-blur border-t border-border">
        <Button className="w-full" disabled={saving || !!duplicate} onClick={save}>
          {duplicate ? "Product already exists" : saving ? "Creating..." : "Create Product"}
        </Button>
      </div>
    </div>
  );
}



export { dateRangeError } from "@/components/DateRangeFields";


