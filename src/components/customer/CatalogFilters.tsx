import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { ProductCardData } from "@/components/ProductCard";
import { cn } from "@/lib/utils";
import { useCustomerProducts } from "@/hooks/useCustomerProducts";

export type CatalogSort = "relevance" | "price-asc" | "price-desc" | "rating" | "discount";

export interface CatalogParams {
  coll?: string; // collections.id
  pc?: string; // categories.id, matched through product_categories
  sort?: CatalogSort;
  max?: number; // max price (1000 = any)
  disc?: boolean;
  stock?: boolean;
}

/** True when any advanced filter is active, i.e. the catalog query (collections / product_categories) applies. */
export function isCatalogMode(p: CatalogParams) {
  return !!(p.coll || p.pc || p.disc || p.stock || (p.max && p.max < 1000) || p.sort === "discount");
}

export function useCollections() {
  return useQuery({
    queryKey: ["home-collections"],
    staleTime: 5 * 60_000,
    queryFn: async () => (await supabase.from("collections").select("id, slug, name").eq("is_active", true).order("display_order")).data ?? [],
  });
}

/**
 * Filtered catalog for /products. Always goes through the PIN-code-aware
 * `list_customer_products` RPC (via useCustomerProducts), so the customer only
 * sees products a nearby shop can deliver, and the search term is kept.
 * Collection membership narrows the RPC by product ids; category goes to the
 * RPC's own category filter; price / stock / discount / discount-sort apply on top.
 */
export function useCatalogProducts(p: CatalogParams & { search?: string | null }, enabled = true) {
  const { coll = null, pc = null, sort = "relevance", max = 1000, disc = false, stock = false, search = null } = p;

  const collectionIds = useQuery({
    queryKey: ["collection-product-ids", coll],
    enabled: enabled && !!coll,
    staleTime: 60_000,
    queryFn: async () =>
      ((await supabase.from("product_collections").select("product_id").eq("collection_id", coll!)).data ?? []).map(
        (r) => r.product_id,
      ),
  });
  const ids = coll ? (collectionIds.data ?? null) : null;

  const rpcSort = sort === "price-asc" ? "price_asc" : sort === "price-desc" ? "price_desc" : sort === "rating" ? "rating" : "relevance";
  const products = useCustomerProducts({
    categoryId: pc,
    search,
    sort: rpcSort,
    ids,
    limit: 200,
    // Wait for the collection's product ids before querying.
    enabled: enabled && (!coll || collectionIds.isSuccess),
    key: `catalog:${coll ?? ""}`,
  });

  const data = useMemo(() => {
    if (coll && collectionIds.isSuccess && collectionIds.data.length === 0) return [] as ProductCardData[];
    if (!products.data) return undefined;
    let rows = products.data;
    if (max < 1000) rows = rows.filter((x) => Number(x.price) <= max);
    if (stock) rows = rows.filter((x) => Number(x.stock) > 0);
    if (disc) rows = rows.filter((x) => Number(x.mrp) > Number(x.price));
    if (sort === "discount")
      rows = [...rows].sort(
        (a, b) =>
          (Number(b.mrp) - Number(b.price)) / Number(b.mrp || 1) - (Number(a.mrp) - Number(a.price)) / Number(a.mrp || 1),
      );
    return rows.slice(0, 60);
  }, [products.data, coll, collectionIds.isSuccess, collectionIds.data, max, stock, disc, sort]);

  return { data };
}

const chip = (active: boolean) =>
  cn(
    "press inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-meta font-medium",
    active ? "bg-foreground text-background" : "border border-border/70 bg-card",
  );

const SORTS: [CatalogSort, string][] = [
  ["relevance", "Relevance"],
  ["price-asc", "Price: low to high"],
  ["price-desc", "Price: high to low"],
  ["rating", "Top rated"],
  ["discount", "Best discount"],
];

/** Filter sheet (sort, max price, collection, discounted, in stock). Calls `onApply` with the new params. */
export function CatalogFilterButton({ value, onApply }: { value: CatalogParams; onApply: (p: CatalogParams) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CatalogParams>(value);
  const collections = useCollections();
  const count = [value.coll, value.disc, value.stock, value.max && value.max < 1000, value.sort && value.sort !== "relevance"].filter(Boolean).length;

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setOpen(true);
        }}
        className="press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3.5 text-meta font-medium"
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        Filters
        {count > 0 && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-micro font-bold text-primary-foreground">{count}</span>}
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side="bottom" className="max-h-[85dvh] overflow-y-auto rounded-t-2xl px-4 pb-[calc(1rem+env(safe-area-inset-bottom))] pt-4">
          <SheetHeader className="text-left">
            <SheetTitle className="text-subtitle">Refine results</SheetTitle>
          </SheetHeader>
          <div className="mt-3 space-y-5">
            <section>
              <div className="eyebrow mb-2">Sort by</div>
              <div className="flex flex-wrap gap-2">
                {SORTS.map(([k, label]) => (
                  <button key={k} type="button" className={chip((draft.sort ?? "relevance") === k)} onClick={() => setDraft({ ...draft, sort: k })}>
                    {label}
                  </button>
                ))}
              </div>
            </section>
            <section>
              <div className="mb-2 flex items-center justify-between">
                <div className="eyebrow">Max price</div>
                <span className="text-meta font-semibold">{(draft.max ?? 1000) >= 1000 ? "Any" : `₹${draft.max}`}</span>
              </div>
              <input type="range" min={50} max={1000} step={50} value={draft.max ?? 1000} onChange={(e) => setDraft({ ...draft, max: Number(e.target.value) })} className="w-full accent-primary" />
            </section>
            {(collections.data?.length ?? 0) > 0 && (
              <section>
                <div className="eyebrow mb-2">Collection</div>
                <div className="flex flex-wrap gap-2">
                  <button type="button" className={chip(!draft.coll)} onClick={() => setDraft({ ...draft, coll: undefined })}>
                    Any
                  </button>
                  {collections.data!.map((c) => (
                    <button key={c.id} type="button" className={chip(draft.coll === c.id)} onClick={() => setDraft({ ...draft, coll: draft.coll === c.id ? undefined : c.id })}>
                      {c.name}
                    </button>
                  ))}
                </div>
              </section>
            )}
            <section className="flex flex-wrap gap-2">
              <button type="button" className={chip(!!draft.disc)} onClick={() => setDraft({ ...draft, disc: !draft.disc })}>
                Discounted only
              </button>
              <button type="button" className={chip(!!draft.stock)} onClick={() => setDraft({ ...draft, stock: !draft.stock })}>
                In stock
              </button>
            </section>
          </div>
          <SheetFooter className="mt-5 flex-row gap-2 sm:space-x-0">
            <button type="button" className="h-11 flex-1 rounded-xl border border-border bg-card text-body font-semibold" onClick={() => setDraft({ pc: draft.pc })}>
              Reset
            </button>
            <button
              type="button"
              className="h-11 flex-1 rounded-xl bg-primary text-body font-semibold text-primary-foreground"
              onClick={() => {
                onApply(draft);
                setOpen(false);
              }}
            >
              Apply
            </button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </>
  );
}

/** Home-page row linking into the /products collection filter. */
export function CollectionChips() {
  const collections = useCollections();
  if (!collections.data || collections.data.length === 0) return null;
  return (
    <section className="space-y-2.5">
      <h2 className="section-title px-4">Collections</h2>
      <div className="scrollbar-hide flex scroll-px-4 gap-2 overflow-x-auto px-4">
        {collections.data.map((c) => (
          <Link key={c.id} to="/products" search={{ coll: c.id } as any} className={chip(false)}>
            {c.name}
          </Link>
        ))}
      </div>
    </section>
  );
}
