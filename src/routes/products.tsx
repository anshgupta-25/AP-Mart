import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerProducts } from "@/hooks/useCustomerProducts";
import { useHeaderOffset } from "@/hooks/useHeaderOffset";
import { CatalogFilterButton, isCatalogMode, toRpcSort, useCatalogProducts, type CatalogParams, type CatalogSort } from "@/components/customer/CatalogFilters";

const search = z.object({
  q: z.string().optional(),
  cat: z.string().optional(),
  coll: z.string().optional(),
  pc: z.string().optional(),
  sort: z.enum(["relevance", "price-asc", "price-desc", "rating", "discount"]).optional(),
  max: z.coerce.number().optional(),
  disc: z.coerce.boolean().optional(),
  stock: z.coerce.boolean().optional(),
});

export const Route = createFileRoute("/products")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "All products — AP Mart" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const { q, cat, coll, pc, sort: sortParam, max, disc, stock } = Route.useSearch();
  const sort: CatalogSort = sortParam ?? "relevance";
  const params: CatalogParams = { coll, pc, sort, max, disc, stock };
  const setParams = (next: CatalogParams) =>
    navigate({ to: "/products", search: { q, cat, ...Object.fromEntries(Object.entries(next).filter(([, v]) => v !== undefined && v !== false && v !== "relevance" && v !== 1000)) } as any });
  const { user, loading, roles } = useAuth() as any;
  const navigate = useNavigate();
  const headerH = useHeaderOffset();
  const [term, setTerm] = useState(q ?? "");
  useEffect(() => setTerm(q ?? ""), [q]);

  useEffect(() => {
    if (loading || !user) return;
    const allowed = roles?.length === 0 || roles?.includes("customer") || roles?.includes("admin");
    if (!allowed) {
      if (roles?.includes("shopkeeper")) navigate({ to: "/shopkeeper/dashboard" });
      else if (roles?.includes("delivery")) navigate({ to: "/delivery/dashboard" });
      else navigate({ to: "/dashboard" });
    }
  }, [loading, user, roles, navigate]);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("id, slug, name, icon, color, display_order").eq("is_active", true).order("display_order")).data ?? [],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const catRow = categories.data?.find((c: any) => c.slug === cat) ?? null;
  const catalogMode = isCatalogMode(params);
  const sortKey = toRpcSort(sort);
  const rpcProducts = useCustomerProducts({
    categoryId: catRow?.id ?? null,
    search: q ?? null,
    sort: sortKey,
    limit: 60,
    enabled: !catalogMode,
    key: `list:${q ?? ""}:${cat ?? ""}:${sort}`,
  });
  const catalogProducts = useCatalogProducts({ ...params, pc: pc ?? catRow?.id, search: q ?? null }, catalogMode);
  const products = catalogMode ? catalogProducts : rpcProducts;

  const title = q ? `Results for "${q}"` : cat ? categories.data?.find((c) => c.slug === cat)?.name : "All products";
  const chip = (active: boolean) =>
    `press inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-meta font-medium ${
      active ? "bg-foreground text-background" : "border border-border/70 bg-card"
    }`;
  const grid = "grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-4 lg:grid-cols-5";

  return (
    <div className="mx-auto max-w-6xl md:grid md:grid-cols-[200px_1fr] md:gap-5 md:px-4">
      <aside className="hidden md:block md:py-5">
        <div className="sticky top-24 overflow-hidden rounded-xl border border-border/70 bg-card">
          <div className="eyebrow px-3.5 pb-1 pt-3.5">Categories</div>
          <div className="p-1.5">
            <Link
              to="/products"
              search={{}}
              className={`block rounded-lg px-3 py-2 text-meta ${!cat ? "bg-primary-soft font-semibold text-primary-ink" : "hover:bg-secondary"}`}
            >
              All
            </Link>
            {categories.data?.map((c) => (
              <Link
                key={c.id}
                to="/products"
                search={{ cat: c.slug } as any}
                className={`block rounded-lg px-3 py-2 text-meta ${cat === c.slug ? "bg-primary-soft font-semibold text-primary-ink" : "hover:bg-secondary"}`}
              >
                <span className="mr-2">{c.icon}</span>
                {c.name}
              </Link>
            ))}
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <div style={{ top: headerH }} className="hairline-b sticky z-30 bg-tint-mint md:hidden">
          <form
            className="px-4 pt-2.5"
            onSubmit={(e) => {
              e.preventDefault();
              const v = term.trim();
              navigate({ to: "/products", search: (v ? { q: v } : {}) as any });
            }}
          >
            <div className="flex h-10 items-center gap-2 rounded-xl bg-card px-3 shadow-soft">
              <Search className="h-4 w-4 shrink-0" />
              <input
                value={term}
                onChange={(e) => setTerm(e.target.value)}
                placeholder="Search for atta, dal, milk and more"
                className="min-w-0 flex-1 bg-transparent text-meta outline-none placeholder:text-muted-foreground"
                enterKeyHint="search"
              />
            </div>
          </form>
          <div className="scrollbar-hide flex scroll-px-4 gap-2 overflow-x-auto px-4 py-2.5">
            <Link to="/products" search={{}} className={chip(!cat)}>All</Link>
            {categories.data?.map((c) => (
              <Link key={c.id} to="/products" search={{ cat: c.slug } as any} className={chip(cat === c.slug)}>
                {c.name}
              </Link>
            ))}
          </div>
        </div>

        <div className="px-4 pb-24 pt-3 md:px-0 md:pb-10 md:pt-5">
          <div className="mb-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <h1 className="truncate text-subtitle font-bold leading-tight">{title}</h1>
              {products.data && (
                <p className="mt-0.5 text-small text-muted-foreground">{products.data.length} items</p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <CatalogFilterButton value={params} onApply={setParams} />
              <select
                value={sort}
                onChange={(e) => setParams({ ...params, sort: e.target.value as CatalogSort })}
                aria-label="Sort products"
                className="h-8 shrink-0 rounded-full border border-border/70 bg-card px-3 text-small font-medium outline-none"
              >
                <option value="relevance">Relevance</option>
                <option value="price-asc">Price: Low to High</option>
                <option value="price-desc">Price: High to Low</option>
                <option value="rating">Top rated</option>
                <option value="discount">Best discount</option>
              </select>
            </div>
          </div>

          {!products.data ? (
            <div className={grid}>
              {Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className="h-[200px] rounded-xl" />)}
            </div>
          ) : products.data.length === 0 ? (
            <div className="rounded-xl border border-border/70 bg-card px-5 py-12 text-center">
              <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-tint-mint">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <p className="section-title mt-3">No products found</p>
              <p className="mt-1 text-meta text-muted-foreground">Try a different search or category.</p>
            </div>
          ) : (
            <div className={grid}>
              {products.data.map((p) => (
                <div key={p.id} className="pb-3">
                  <ProductCard product={p} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
