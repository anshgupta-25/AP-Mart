import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StorageImg } from "@/components/StorageImg";
import { CategoryGroups } from "@/components/customer/CategoryGroups";
import { loadProductCategoriesMap } from "@/lib/productCategories";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
import { useHeaderOffset } from "@/hooks/useHeaderOffset";
import { rpcArgs } from "@/integrations/supabase/rpc";

const search = z.object({ q: z.string().optional(), chip: z.string().optional() });

export const Route = createFileRoute("/customer/categories")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Shop by category — AP Mart" }] }),
  component: CategoriesBrowse,
});

const CHIPS = [
  { key: "popular", label: "Popular" },
  { key: "offers", label: "Offers" },
  { key: "organic", label: "Organic" },
  { key: "new", label: "New" },
  { key: "fast", label: "Fast Delivery" },
  { key: "summer", label: "Summer" },
  { key: "trending", label: "Trending" },
  { key: "healthy", label: "Healthy" },
  { key: "imported", label: "Imported" },
];

const TINTS = [
  "bg-tint-mint",
  "bg-tint-sun",
  "bg-tint-sky",
  "bg-tint-rose",
  "bg-tint-violet",
  "bg-tint-peach",
];

function CategoriesBrowse() {
  const { q: qParam, chip } = Route.useSearch();
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

  const filtered = useMemo(() => {
    const list = categories.data ?? [];
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter(
      (c) => c.name.toLowerCase().includes(needle) || c.slug.toLowerCase().includes(needle),
    );
  }, [categories.data, query]);

  const searching = query.trim().length > 0;

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate({ to: "/products", search: { q: query.trim() } });
  };

  return (
    <div className="pb-6">
      {/* Pin below the storefront header (same approach as /products and /category/$slug). */}
      <div style={{ top: headerH }} className="hairline-b sticky z-30 bg-tint-mint px-4 pb-3 pt-4">
        <h1 className="large-title">Categories</h1>
        <form
          onSubmit={onSubmitSearch}
          className="mt-3 flex h-11 items-center gap-2.5 rounded-xl bg-card px-3.5 shadow-soft"
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

      <div className="space-y-6 pt-4">
        <div className="scrollbar-hide flex scroll-px-4 gap-2 overflow-x-auto px-4">
          {CHIPS.map((c) => {
            const active = chip === c.key;
            return (
              <button
                key={c.key}
                type="button"
                onClick={() => navigate({ search: { chip: active ? undefined : c.key } as any })}
                className={`press inline-flex h-8 shrink-0 items-center rounded-full px-3.5 text-meta font-medium ${active ? "bg-foreground text-background" : "border border-border/70 bg-card"}`}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        {categories.isLoading ? (
          <div className="grid grid-cols-4 gap-x-2.5 gap-y-4 px-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl shimmer" />
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
            <CategoryGroups categories={categories.data} from={0} count={99} />
            <CategoryTiles
              items={categories.data ?? []}
              title="All categories"
              counts={counts.data}
            />
          </>
        )}

        {collections.data && collections.data.length > 0 && !searching && (
          <section className="space-y-3">
            <div className="flex items-center justify-between px-4">
              <h2 className="section-title">Featured collections</h2>
              <Link to="/products" className="press text-meta font-semibold text-primary">
                See all
              </Link>
            </div>
            <div className="scrollbar-hide flex gap-2.5 overflow-x-auto px-4">
              {collections.data.map((col) => (
                <Link
                  key={col.id}
                  to="/products"
                  search={{ coll: col.id }}
                  className="press relative block h-[104px] w-[200px] shrink-0 overflow-hidden rounded-xl bg-foreground/80"
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
    <section className="cv-auto space-y-3 px-4">
      <h2 className="section-title">{title}</h2>
      <div className="grid grid-cols-4 gap-x-2.5 gap-y-4">
        {items.map((c, i) => (
          <Link
            key={c.id}
            to="/category/$slug"
            params={{ slug: c.slug }}
            className="press flex flex-col items-center gap-1.5"
          >
            <div
              className={`${TINTS[i % TINTS.length]} relative grid aspect-square w-full place-items-center rounded-xl text-[28px]`}
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
