import { useMemo, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { Library, Package, Search, ChevronLeft, ChevronRight, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { MultiImageInput } from "@/components/MultiImageInput";
import { VariantsEditor, type VariantDraft } from "@/components/VariantsEditor";
import { saveVariants } from "@/lib/variants";
import { DateRangeFields, dateRangeError } from "@/components/DateRangeFields";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { rupees } from "@/lib/format";
import { StorageImg } from "@/components/StorageImg";
import { rpcArgs } from "@/integrations/supabase/rpc";
import { errorMessage } from "@/lib/utils";

export type CatalogRow = {
  id: string;
  name: string;
  brand: string | null;
  unit: string | null;
  image: string | null;
  mrp: number | null;
  price: number | null;
  category_names: string[] | null;
  already_added: boolean;
  total_count: number;
};

const PAGE_SIZE = 12;

export function useMasterCatalog(opts: {
  shopId: string | null;
  q: string;
  categoryId: string;
  brand: string;
  page: number;
  enabled?: boolean;
}) {
  const { shopId, q, categoryId, brand, page, enabled = true } = opts;
  return useQuery({
    queryKey: ["master-catalog", shopId, q, categoryId, brand, page],
    enabled,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "search_master_catalog",
        rpcArgs("search_master_catalog", {
          _shop_id: shopId,
          _q: q || null,
          _category_id: categoryId === "all" ? null : categoryId,
          _brand: brand === "all" ? null : brand,
          _limit: PAGE_SIZE,
          _offset: page * PAGE_SIZE,
        }),
      );
      if (error) throw error;
      return (data ?? []) as CatalogRow[];
    },
  });
}

/** Full "Add from Catalog" flow: browse the master catalog, then add to this shop. */
export function CatalogDialogContent({
  shopId,
  categories,
  onDone,
}: {
  shopId: string;
  categories: { id: string; name: string }[];
  onDone: () => void;
}) {
  const [q, setQ] = useState("");
  const dq = useDebouncedValue(q, 300);
  const [categoryId, setCategoryId] = useState("all");
  const [brand, setBrand] = useState("all");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<CatalogRow | null>(null);

  const rows = useMasterCatalog({ shopId, q: dq, categoryId, brand, page, enabled: !selected });

  const brands = useQuery({
    queryKey: ["master-catalog-brands"],
    staleTime: 10 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("master_catalog_brands");
      if (error) throw error;
      return ((data ?? []) as { brand: string }[]).map((b) => b.brand);
    },
  });

  const total = rows.data?.[0]?.total_count ?? 0;
  const pages = useMemo(() => Math.max(1, Math.ceil(Number(total) / PAGE_SIZE)), [total]);

  if (selected) {
    return (
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <AddToShopForm
          shopId={shopId}
          product={selected}
          onBack={() => setSelected(null)}
          onDone={onDone}
        />
      </DialogContent>
    );
  }

  return (
    <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <Library className="h-5 w-5 text-primary" />
          AP Mart Catalog
        </DialogTitle>
        <DialogDescription>
          Pick a product that already exists on AP Mart and add it to your shop with your own price
          and stock.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => {
                setQ(e.target.value);
                setPage(0);
              }}
              placeholder="Search catalog by name or brand..."
              className="pl-9"
            />
          </div>
          <Select
            value={categoryId}
            onValueChange={(v) => {
              setCategoryId(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="sm:w-44">
              <SelectValue placeholder="All categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All categories</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={brand}
            onValueChange={(v) => {
              setBrand(v);
              setPage(0);
            }}
          >
            <SelectTrigger className="sm:w-40">
              <SelectValue placeholder="All brands" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All brands</SelectItem>
              {(brands.data ?? []).map((b) => (
                <SelectItem key={b} value={b}>
                  {b}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {rows.isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-28 rounded-xl shimmer" />
            ))}
          </div>
        ) : (rows.data ?? []).length === 0 ? (
          <div className="py-10 text-center text-sm text-muted-foreground">
            No catalog products match your filters. Use{" "}
            <span className="font-semibold">Add Product</span> to create a new one.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {(rows.data ?? []).map((p) => (
              <div
                key={p.id}
                className="flex flex-col gap-3 rounded-xl border border-border/70 bg-card p-3"
              >
                <div className="flex gap-3">
                  {p.image ? (
                    <StorageImg
                      loading="lazy"
                      decoding="async"
                      src={p.image}
                      alt={p.name}
                      className="h-16 w-16 rounded-xl object-cover shrink-0"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-secondary grid place-items-center shrink-0">
                      <Package className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="line-clamp-2 text-meta font-semibold">{p.name}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {[p.brand, p.unit].filter(Boolean).join(" · ") || "—"}
                    </div>
                    {(p.category_names ?? []).length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {(p.category_names ?? []).slice(0, 2).map((c) => (
                          <span
                            key={c}
                            className="text-caption px-2 py-0.5 rounded-full bg-primary-soft text-primary-ink font-medium"
                          >
                            {c}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {p.already_added ? (
                  <div className="flex items-center justify-center gap-1 rounded-lg bg-secondary py-2 text-small font-medium text-muted-foreground">
                    <CheckCircle2 className="h-4 w-4 text-primary" /> Already in your shop
                  </div>
                ) : (
                  <Button size="sm" className="w-full" onClick={() => setSelected(p)}>
                    Add to My Shop
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}

        {pages > 1 && (
          <div className="flex items-center justify-between pt-1">
            <span className="text-xs text-muted-foreground">
              Page {page + 1} of {pages}
            </span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 0}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page + 1 >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );
}

function AddToShopForm({
  shopId,
  product,
  onBack,
  onDone,
}: {
  shopId: string;
  product: CatalogRow;
  onBack: () => void;
  onDone: () => void;
}) {
  const [price, setPrice] = useState<number>(Number(product.price) || 0);
  const [mrp, setMrp] = useState<number>(Number(product.mrp) || 0);
  const [retail, setRetail] = useState<number>(0);
  const [stock, setStock] = useState<number>(0);
  const [sku, setSku] = useState("");
  const [barcode, setBarcode] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [mfgDate, setMfgDate] = useState("");
  const [expDate, setExpDate] = useState("");
  const [variants, setVariants] = useState<VariantDraft[]>([]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!(price > 0)) return toast.error("Selling price must be greater than 0");
    if (stock < 0) return toast.error("Stock cannot be negative");
    const dErr = dateRangeError(mfgDate, expDate);
    if (dErr) return toast.error(dErr);

    setSaving(true);
    try {
      const { error } = await supabase.from("shop_products").insert({
        shop_id: shopId,
        product_id: product.id,
        price,
        mrp: mrp || price,
        retail_price: retail || null,
        stock,
        initial_stock: stock,
        sku: sku || null,
        barcode: barcode || null,
        images,
        is_available: true,
        manufacturing_date: mfgDate || null,
        expiry_date: expDate || null,
      });
      if (error) {
        if (error.code === "23505") {
          toast.error(`${product.name} has already been added to your shop.`);
          return;
        }
        throw error;
      }
      const active = variants.filter((v) => !v._deleted);
      if (active.length > 0) await saveVariants(product.id, variants);
      toast.success(`${product.name} added to your shop`);
      onDone();
    } catch (e) {
      toast.error(errorMessage(e, "Failed to add product"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <DialogHeader>
        <DialogTitle>Add to my shop</DialogTitle>
        <DialogDescription>
          Only your shop-specific details are needed — the product itself already exists.
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-3">
        <div className="flex items-center gap-3 rounded-2xl bg-secondary p-3">
          {product.image ? (
            <StorageImg
              loading="lazy"
              decoding="async"
              src={product.image}
              alt={product.name}
              className="h-12 w-12 rounded-lg object-cover"
            />
          ) : (
            <div className="h-12 w-12 rounded-lg bg-card grid place-items-center">
              <Package className="h-4 w-4 text-muted-foreground" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="truncate text-body font-semibold">{product.name}</div>
            <div className="text-xs text-muted-foreground truncate">
              {[product.brand, product.unit].filter(Boolean).join(" · ")}
              {product.mrp ? ` · MRP ${rupees(Number(product.mrp))}` : ""}
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={onBack}>
            Change
          </Button>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-meta font-medium">
              Selling price ₹ <span className="text-destructive">*</span>
            </label>
            <Input type="number" value={price} onChange={(e) => setPrice(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-meta font-medium">MRP ₹</label>
            <Input type="number" value={mrp} onChange={(e) => setMrp(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-meta font-medium">Retail ₹</label>
            <Input
              type="number"
              value={retail}
              onChange={(e) => setRetail(Number(e.target.value))}
            />
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="text-meta font-medium">
              Stock <span className="text-destructive">*</span>
            </label>
            <Input type="number" value={stock} onChange={(e) => setStock(Number(e.target.value))} />
          </div>
          <div>
            <label className="text-meta font-medium">SKU</label>
            <Input value={sku} onChange={(e) => setSku(e.target.value)} />
          </div>
          <div>
            <label className="text-meta font-medium">Barcode</label>
            <Input value={barcode} onChange={(e) => setBarcode(e.target.value)} />
          </div>
        </div>

        <DateRangeFields mfg={mfgDate} exp={expDate} onMfg={setMfgDate} onExp={setExpDate} />

        <div className="pt-2 border-t border-border">
          <MultiImageInput
            value={images}
            onChange={setImages}
            label="Your product images (optional)"
            required={false}
          />
        </div>

        <div className="pt-2 border-t border-border">
          <VariantsEditor variants={variants} onChange={setVariants} />
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" onClick={onBack}>
          Back
        </Button>
        <Button disabled={saving} onClick={save}>
          {saving ? "Adding..." : "Add to my shop"}
        </Button>
      </DialogFooter>
    </>
  );
}
