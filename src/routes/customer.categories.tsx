import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import {
  ArrowDownNarrowWide,
  BadgePercent,
  PackageCheck,
  Search,
  Sparkles,
  Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StorageImg } from "@/components/StorageImg";
import { CategoryGroups } from "@/components/customer/CategoryGroups";
import { useSubcategoriesAll } from "@/hooks/useSubcategoriesAll";
import { loadProductCategoriesMap } from "@/lib/productCategories";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
import { useHeaderOffset } from "@/hooks/useHeaderOffset";
import { rpcArgs } from "@/integrations/supabase/rpc";

const search = z.object({ q: z.string().optional() });

export const Route = createFileRoute("/customer/categories")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Shop by category — AP Mart" }] }),
  component: CategoriesBrowse,
});

/** Quick picks open the product list with a real filter (the products page supports these). */
const QUICK_PICKS = [
  { key: "popular", label: "Popular", icon: Star, search: { sort: "rating" as const } },
  {
    key: "offers",
    label: "Offers",
    icon: BadgePercent,
    search: { disc: true, sort: "discount" as const },
  },
  {
    key: "cheap",
    label: "Lowest price",
    icon: ArrowDownNarrowWide,
    search: { sort: "price-asc" as const },
  },
  { key: "stock", label: "In stock", icon: PackageCheck, search: { stock: true } },
];

const TINTS = [
  "bg-tint-mint",
  "bg-tint-sun",
  "bg-tint-sky",
  "bg-tint-rose",
  "bg-tint-violet",
  "bg-tint-peach",
];

/** Height of the sticky search bar (h-11 field + py-3), used to offset jump-to-section scrolling. */
const SEARCH_BAR_H = 68;

function CategoriesBrowse() {
  const { q: qParam } = Route.useSearch();
  const navigate = useNavigate();
  const headerH = useHeaderOffset();
  const [query, setQuery] = useState(qParam ?? "");

  const categories = useQuery({
    queryKey: ["cats-browse"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, icon, color, display_order, image_url")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data ?? [];
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const subs = useSubcategoriesAll();

  const { pincode, ready } = useDeliveryContext();
  const counts = useQuery({
    queryKey: ["cat-product-counts", pincode],
    enabled: ready,
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data } = await supabase.rpc(
        "list_customer_products",
        rpcArgs("list_customer_products", {
          _pincode: pincode,
          _category_id: null,
          _search: null,
          _only_featured: false,
          _only_bestseller: false,
          _sort: "relevance",
          _limit: 1000,
          _ids: null,
        }),
      );
      const rows = data ?? [];
      const linkMap = await loadProductCategoriesMap(rows.map((r) => r.id));
      const map: Record<string, number> = {};
      rows.forEach((r) => {
        const cats = linkMap[r.id]?.length ? linkMap[r.id] : r.category_id ? [r.category_id] : [];
        new Set(cats).forEach((cid) => {
          map[cid] = (map[cid] ?? 0) + 1;
        });
      });
      return map;
    },
  });

  const collections = useQuery({
    queryKey: ["cats-collections"],
    queryFn: async () =>
      (
        await supabase
          .from("collections")
          .select("*")
          .eq("is_active", true)
          .order("display_order")
          .limit(6)
      ).data ?? [],
  });

  const all = useMemo(() => categories.data ?? [], [categories.data]);
  // Categories that have subcategories get their own section below; the rest are grouped
  // once under "More categories", so nothing is listed twice.
  const withSubs = useMemo(() => {
    const ids = new Set((subs.data ?? []).map((s) => s.category_id));
    return new Set(all.filter((c) => ids.has(c.id)).map((c) => c.id));
  }, [all, subs.data]);
  const sectioned = all.filter((c) => withSubs.has(c.id));
  const others = all.filter((c) => !withSubs.has(c.id));

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.slug.toLowerCase().includes(needle),
    );
  }, [all, query]);

  const searching = query.trim().length > 0;
  const anchorOffset = headerH + SEARCH_BAR_H + 8;

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate({ to: "/products", search: { q: query.trim() } });
  };

  /** Scroll to a category's section on this page, or open its page if it has none. */
  const openCategory = (c: { id: string; slug: string }) => {
    const el = withSubs.has(c.id) ? document.getElementById(`cat-${c.slug}`) : null;
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    else navigate({ to: "/category/$slug", params: { slug: c.slug } });
  };

  const loading = categories.isLoading || subs.isLoading;

  return (
    <div className="pb-10">
      {/* Title scrolls away; only the search bar stays pinned below the storefront header. */}
      <div className="bg-tint-mint px-4 pb-1 pt-4">
        <h1 className="large-title">Categories</h1>
        <p className="mt-0.5 text-meta text-muted-foreground">
          {all.length ? `${all.length} categories from shops near you` : "Shops near you"}
        </p>
      </div>
      <div style={{ top: headerH }} className="hairline-b sticky z-30 bg-tint-mint px-4 py-3">
        <form
          onSubmit={onSubmitSearch}
          className="flex h-11 items-center gap-2.5 rounded-xl bg-card px-3.5 shadow-soft"
        >
          <Search className="h-[18px] w-[18px] shrink-0 text-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories and products"
            className="min-w-0 flex-1 bg-transparent text-body placeholder:text-muted-foreground focus:outline-none"
          />
        </form>
      </div>

      <div className="space-y-8 pt-5">
        {/* Quick picks: real filters on the product list, plus active collections */}
        {!searching && (
          <section className="space-y-2.5">
            <h2 className="section-title px-4">Quick picks</h2>
            <div className="scrollbar-hide flex scroll-px-4 gap-2 overflow-x-auto px-4">
              {QUICK_PICKS.map((p) => {
                const Icon = p.icon;
                return (
                  <Link
                    key={p.key}
                    to="/products"
                    search={p.search}
                    className="press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3.5 text-meta font-medium"
                  >
                    <Icon className="h-4 w-4 text-primary" />
                    {p.label}
                  </Link>
                );
              })}
              {(collections.data ?? []).map((col) => (
                <Link
                  key={col.id}
                  to="/products"
                  search={{ coll: col.id }}
                  className="press inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3.5 text-meta font-medium"
                >
                  <Sparkles className="h-4 w-4 text-primary" />
                  {col.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {loading ? (
          <div className="grid grid-cols-4 gap-x-3 gap-y-5 px-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-2xl shimmer" />
            ))}
          </div>
        ) : categories.isError && !categories.data ? (
          <div className="mx-4 rounded-xl border border-border/70 bg-card px-5 py-10 text-center">
            <p className="text-meta text-muted-foreground">Couldn’t load categories.</p>
            <button
              onClick={() => categories.refetch()}
              className="press mt-3 h-10 rounded-xl bg-primary px-6 text-meta font-semibold text-primary-foreground"
            >
              Try again
            </button>
          </div>
        ) : searching && filtered.length === 0 ? (
          <EmptyState onReset={() => setQuery("")} />
        ) : searching ? (
          <CategoryTiles items={filtered} title="Matching categories" counts={counts.data} />
        ) : (
          <>
            {/* 1. Every category at a glance; tapping jumps to its section */}
            <section className="space-y-3">
              <h2 className="section-title px-4">Shop by category</h2>
              <div className="scrollbar-hide flex scroll-px-4 gap-3 overflow-x-auto px-4 pb-1">
                {all.map((c, i) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => openCategory(c)}
                    className="press flex w-[72px] shrink-0 flex-col items-center gap-1.5"
                  >
                    <span
                      className={`${TINTS[i % TINTS.length]} grid h-16 w-16 place-items-center rounded-2xl text-[28px]`}
                    >
                      {c.icon ?? "🛍️"}
                    </span>
                    <span className="line-clamp-2 text-center text-caption font-medium leading-[14px]">
                      {c.name}
                    </span>
                  </button>
                ))}
              </div>
            </section>

            {/* 2. One section per category with its subcategories */}
            <CategoryGroups
              categories={sectioned}
              from={0}
              count={sectioned.length}
              showAll
              anchorOffset={anchorOffset}
              className="space-y-3.5"
            />

            {/* 3. Categories without subcategories, listed once */}
            {others.length > 0 && (
              <CategoryTiles
                items={others}
                title={sectioned.length ? "More categories" : "All categories"}
                counts={counts.data}
              />
            )}

            {/* 4. Collections, as visual cards */}
            {collections.data && collections.data.length > 0 && (
              <section className="space-y-3">
                <div className="flex items-center justify-between px-4">
                  <h2 className="section-title">Featured collections</h2>
                  <Link to="/products" className="press text-meta font-semibold text-primary">
                    See all
                  </Link>
                </div>
                <div className="scrollbar-hide flex gap-3 overflow-x-auto px-4">
                  {collections.data.map((col) => (
                    <Link
                      key={col.id}
                      to="/products"
                      search={{ coll: col.id }}
                      className="press relative block h-[104px] w-[200px] shrink-0 overflow-hidden rounded-2xl bg-foreground/80"
                    >
                      {col.image_url && (
                        <StorageImg
                          src={col.image_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover"
                          loading="lazy"
                        />
                      )}
                      <div className="absolute inset-0 bg-black/35" />
                      <div className="relative flex h-full flex-col justify-end p-3 text-white">
                        <div className="text-body font-semibold leading-tight">{col.name}</div>
                        {col.description && (
                          <div className="mt-0.5 line-clamp-1 text-caption opacity-90">
                            {col.description}
                          </div>
                        )}
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CategoryTiles({
  items,
  title,
  counts,
}: {
  items: { id: string; slug: string; name: string; icon: string | null }[];
  title: string;
  counts?: Record<string, number>;
}) {
  return (
    <section className="space-y-3.5 px-4">
      <h2 className="section-title">{title}</h2>
      <div className="grid grid-cols-4 gap-x-3 gap-y-5">
        {items.map((c, i) => (
          <Link
            key={c.id}
            to="/category/$slug"
            params={{ slug: c.slug }}
            className="press flex flex-col items-center gap-1.5"
          >
            <div
              className={`${TINTS[i % TINTS.length]} relative grid aspect-square w-full place-items-center rounded-2xl text-[28px]`}
            >
              {c.icon ?? "🛍️"}
              {(counts?.[c.id] ?? 0) > 0 && (
                <span className="absolute right-1 top-1 rounded-full bg-card/90 px-1.5 text-micro font-semibold text-foreground/70">
                  {counts![c.id]}
                </span>
              )}
            </div>
            <span className="line-clamp-2 text-center text-caption font-medium leading-[14px]">
              {c.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="mx-4 rounded-xl border border-border/70 bg-card px-5 py-12 text-center">
      <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-tint-mint text-primary-ink">
        <Search className="h-5 w-5" strokeWidth={1.8} />
      </div>
      <div className="section-title mt-3">No categories match</div>
      <div className="mt-1 text-meta text-muted-foreground">
        Try another keyword, or search all products.
      </div>
      <button
        onClick={onReset}
        className="press mt-4 h-10 rounded-xl bg-primary px-6 text-meta font-semibold text-primary-foreground"
      >
        Clear search
      </button>
    </div>
  );
}
