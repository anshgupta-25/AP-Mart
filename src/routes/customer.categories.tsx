import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { z } from "zod";
import {
  ArrowDownNarrowWide,
  BadgePercent,
  ChevronRight,
  PackageCheck,
  Search,
  Sparkles,
  Star,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductImage } from "@/components/ProductImage";
import { loadProductCategoriesMap } from "@/lib/productCategories";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
import { useHeaderOffset } from "@/hooks/useHeaderOffset";
import { useSubcategoriesAll } from "@/hooks/useSubcategoriesAll";
import { rpcArgs } from "@/integrations/supabase/rpc";
import { cn } from "@/lib/utils";

/** `c` = selected category slug (kept in the URL so Back returns to the same category). */
const search = z.object({ q: z.string().optional(), c: z.string().optional() });

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

/** Height of the sticky search bar (h-10 field + py-2.5). */
const SEARCH_BAR_H = 60;

type Category = { id: string; slug: string; name: string; icon: string | null };

function CategoriesBrowse() {
  const { q: qParam, c: selectedSlug } = Route.useSearch();
  const navigate = useNavigate();
  const headerH = useHeaderOffset();
  const [query, setQuery] = useState(qParam ?? "");
  const panelTop = useRef<HTMLDivElement>(null);

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
          .select("id, name")
          .eq("is_active", true)
          .order("display_order")
          .limit(6)
      ).data ?? [],
  });

  const all = useMemo(() => (categories.data ?? []) as Category[], [categories.data]);
  const selected = all.find((c) => c.slug === selectedSlug) ?? all[0];
  const selectedSubs = useMemo(
    () => (subs.data ?? []).filter((s) => s.category_id === selected?.id),
    [subs.data, selected?.id],
  );

  // Search: match categories and subcategories by name.
  const needle = query.trim().toLowerCase();
  const searching = needle.length > 0;
  const catById = useMemo(() => new Map(all.map((c) => [c.id, c])), [all]);
  const results = useMemo(() => {
    if (!needle) return { cats: [] as Category[], subs: [] as typeof selectedSubs };
    return {
      cats: all.filter((c) => c.name.toLowerCase().includes(needle)),
      subs: (subs.data ?? []).filter(
        (s) => s.name.toLowerCase().includes(needle) && catById.has(s.category_id),
      ),
    };
  }, [needle, all, subs.data, catById]);

  const selectCategory = (slug: string) => {
    navigate({ to: "/customer/categories", search: { c: slug }, replace: true });
  };

  // Switching category brings the panel back to its top.
  useEffect(() => {
    const el = panelTop.current;
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - headerH - SEARCH_BAR_H;
    if (window.scrollY > top) window.scrollTo({ top, behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the category changes
  }, [selected?.id]);

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate({ to: "/products", search: { q: query.trim() } });
  };

  const stickyTop = headerH + SEARCH_BAR_H;
  const loading = categories.isLoading || subs.isLoading;
  const count = selected ? (counts.data?.[selected.id] ?? 0) : 0;

  return (
    <div>
      {/* Search (pinned below the storefront header) */}
      <div style={{ top: headerH }} className="hairline-b sticky z-30 bg-tint-mint px-4 py-2.5">
        <form
          onSubmit={onSubmitSearch}
          className="flex h-10 items-center gap-2.5 rounded-xl bg-card px-3.5 shadow-soft"
        >
          <Search className="h-[17px] w-[17px] shrink-0 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search categories and products"
            className="min-w-0 flex-1 bg-transparent text-body placeholder:text-muted-foreground focus:outline-none"
          />
          {query && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => setQuery("")}
              className="grid h-6 w-6 place-items-center rounded-full text-muted-foreground hover:bg-secondary"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </form>
      </div>

      {searching ? (
        <SearchResults
          query={query.trim()}
          cats={results.cats}
          subs={results.subs}
          catById={catById}
        />
      ) : (
        <>
          {/* Quick picks: one slim row of real shortcuts */}
          <div className="scrollbar-hide flex scroll-px-4 gap-2 overflow-x-auto px-4 pb-3 pt-3.5">
            {QUICK_PICKS.map((p) => {
              const Icon = p.icon;
              return (
                <Link key={p.key} to="/products" search={p.search} className={chip}>
                  <Icon className="h-3.5 w-3.5 text-primary" />
                  {p.label}
                </Link>
              );
            })}
            {(collections.data ?? []).map((col) => (
              <Link key={col.id} to="/products" search={{ coll: col.id }} className={chip}>
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {col.name}
              </Link>
            ))}
          </div>

          {loading ? (
            <div className="flex gap-3 px-3">
              <div className="w-[76px] shrink-0 space-y-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="mx-auto h-14 w-14 rounded-2xl shimmer" />
                ))}
              </div>
              <div className="grid flex-1 grid-cols-3 gap-3">
                {Array.from({ length: 9 }).map((_, i) => (
                  <div key={i} className="aspect-square rounded-2xl shimmer" />
                ))}
              </div>
            </div>
          ) : categories.isError && !categories.data ? (
            <div className="mx-4 rounded-2xl border border-border/60 bg-card px-5 py-10 text-center">
              <p className="text-meta text-muted-foreground">Couldn’t load categories.</p>
              <button
                onClick={() => categories.refetch()}
                className="press mt-3 h-10 rounded-xl bg-primary px-6 text-meta font-semibold text-primary-foreground"
              >
                Try again
              </button>
            </div>
          ) : !selected ? (
            <p className="px-4 py-10 text-center text-meta text-muted-foreground">
              No categories yet.
            </p>
          ) : (
            <div className="flex items-start border-t border-border/50">
              {/* Left rail: every category, listed once. Its height leaves room for the
                  shell's bottom padding (tab bar + floating cart bar: pb-36 / md:pb-10), so it
                  stays fully visible and pinned at any scroll position. */}
              <nav
                aria-label="Categories"
                style={{ top: stickyTop, height: `calc(100dvh - ${stickyTop}px - var(--tabbar))` }}
                className="scrollbar-hide sticky w-[84px] shrink-0 overflow-y-auto border-r border-border/50 bg-card pb-4 [--tabbar:144px] md:w-[120px] md:[--tabbar:40px]"
              >
                {all.map((c) => {
                  const on = c.id === selected.id;
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectCategory(c.slug)}
                      aria-current={on ? "true" : undefined}
                      className={cn(
                        "relative flex w-full flex-col items-center gap-1.5 px-1.5 py-3 text-center transition-colors",
                        on ? "bg-primary-soft/60" : "hover:bg-secondary/60",
                      )}
                    >
                      {on && (
                        <span className="absolute inset-y-2 right-0 w-[3px] rounded-l-full bg-primary" />
                      )}
                      <span
                        className={cn(
                          "grid h-12 w-12 place-items-center rounded-2xl text-[24px] transition-colors",
                          on ? "bg-card shadow-soft" : "bg-secondary/70",
                        )}
                      >
                        {c.icon ?? "🛍️"}
                      </span>
                      <span
                        className={cn(
                          "line-clamp-2 text-[11px] leading-[13px]",
                          on
                            ? "font-semibold text-foreground"
                            : "font-medium text-muted-foreground",
                        )}
                      >
                        {c.name}
                      </span>
                    </button>
                  );
                })}
              </nav>

              {/* Right panel: the selected category */}
              <section ref={panelTop} className="min-w-0 flex-1 px-4 pb-6 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h1 className="text-[19px] font-semibold leading-tight tracking-[-0.02em]">
                      {selected.name}
                    </h1>
                    <p className="mt-0.5 text-caption text-muted-foreground">
                      {counts.isFetched
                        ? count > 0
                          ? `${count} product${count === 1 ? "" : "s"} near you`
                          : "No products near you yet"
                        : "Checking shops near you…"}
                    </p>
                  </div>
                  <Link
                    to="/category/$slug"
                    params={{ slug: selected.slug }}
                    className="press inline-flex shrink-0 items-center gap-0.5 rounded-full bg-primary-soft px-3 py-1.5 text-caption font-semibold text-primary-ink"
                  >
                    View all <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {selectedSubs.length > 0 ? (
                  <div className="mt-5 grid grid-cols-3 gap-x-3 gap-y-5 md:grid-cols-5 lg:grid-cols-6">
                    {selectedSubs.map((s) => (
                      <Link
                        key={s.id}
                        to="/category/$slug"
                        params={{ slug: selected.slug }}
                        search={{ sub: s.id } as never}
                        className="press flex flex-col items-center gap-2"
                      >
                        <div className="grid aspect-square w-full place-items-center overflow-hidden rounded-2xl bg-tint-mint ring-1 ring-black/5">
                          {s.image_url ? (
                            <ProductImage
                              src={s.image_url}
                              alt={s.name}
                              fit="cover"
                              className="h-full w-full bg-transparent"
                            />
                          ) : (
                            <span className="text-[30px]">{s.icon ?? selected.icon ?? "🛍️"}</span>
                          )}
                        </div>
                        <span className="line-clamp-2 text-center text-caption font-medium leading-[14px]">
                          {s.name}
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <Link
                    to="/category/$slug"
                    params={{ slug: selected.slug }}
                    className="press mt-5 flex items-center gap-3 rounded-2xl border border-border/60 bg-card p-4"
                  >
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-tint-mint text-[24px]">
                      {selected.icon ?? "🛍️"}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-body font-semibold">
                        Browse all {selected.name}
                      </span>
                      <span className="block text-caption text-muted-foreground">
                        See every product in this category
                      </span>
                    </span>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const chip =
  "press inline-flex h-8 shrink-0 items-center gap-1.5 rounded-full border border-border/70 bg-card px-3 text-caption font-medium";

function SearchResults({
  query,
  cats,
  subs,
  catById,
}: {
  query: string;
  cats: Category[];
  subs: { id: string; category_id: string; name: string; icon: string | null }[];
  catById: Map<string, Category>;
}) {
  const none = cats.length === 0 && subs.length === 0;
  return (
    <div className="space-y-5 px-4 pt-4">
      {none ? (
        <div className="rounded-2xl border border-border/60 bg-card px-5 py-10 text-center">
          <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-tint-mint text-primary-ink">
            <Search className="h-5 w-5" strokeWidth={1.8} />
          </div>
          <div className="mt-3 text-body font-semibold">No categories match “{query}”</div>
          <p className="mt-1 text-caption text-muted-foreground">
            You can still search all products for it.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card">
          {cats.map((c) => (
            <ResultRow
              key={c.id}
              icon={c.icon}
              title={c.name}
              subtitle="Category"
              to={{ slug: c.slug }}
            />
          ))}
          {subs.map((s) => {
            const parent = catById.get(s.category_id)!;
            return (
              <ResultRow
                key={s.id}
                icon={s.icon ?? parent.icon}
                title={s.name}
                subtitle={`in ${parent.name}`}
                to={{ slug: parent.slug, sub: s.id }}
              />
            );
          })}
        </div>
      )}
      <Link
        to="/products"
        search={{ q: query }}
        className="press flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-meta font-semibold text-primary-foreground"
      >
        <Search className="h-4 w-4" /> Search products for “{query}”
      </Link>
    </div>
  );
}

function ResultRow({
  icon,
  title,
  subtitle,
  to,
}: {
  icon: string | null;
  title: string;
  subtitle: string;
  to: { slug: string; sub?: string };
}) {
  return (
    <Link
      to="/category/$slug"
      params={{ slug: to.slug }}
      search={(to.sub ? { sub: to.sub } : {}) as never}
      className="press flex items-center gap-3 border-b border-border/50 px-3.5 py-3 last:border-b-0"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tint-mint text-[20px]">
        {icon ?? "🛍️"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-body font-medium">{title}</span>
        <span className="block truncate text-caption text-muted-foreground">{subtitle}</span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
    </Link>
  );
}
