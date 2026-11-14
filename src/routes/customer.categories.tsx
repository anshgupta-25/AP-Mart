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

/** Pinned top block under the storefront header: search bar (h-10 + py-2.5) + quick-picks row. */
const SEARCH_BAR_H = 60;
const QUICK_ROW_H = 56;

type Category = { id: string; slug: string; name: string; icon: string | null };

function CategoriesBrowse() {
  const { q: qParam, c: selectedSlug } = Route.useSearch();
  const navigate = useNavigate();
  const headerH = useHeaderOffset();
  const [query, setQuery] = useState(qParam ?? "");
  const panelRef = useRef<HTMLElement>(null);
  const railRef = useRef<HTMLElement>(null);
  const [tabH, setTabH] = useState(0);

  // Height of the fixed bottom tab bar (0 on desktop, where it is hidden), so the two columns
  // can fill exactly the space between the pinned top and the tab bar.
  useEffect(() => {
    const el = document.querySelector("nav.fixed.bottom-0") as HTMLElement | null;
    const measure = () => setTabH(el ? Math.round(el.getBoundingClientRect().height) : 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, []);

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

  // Switching category scrolls the panel back to its top and keeps the chosen category
  // visible in the rail (also when arriving with ?c=...).
  useEffect(() => {
    panelRef.current?.scrollTo({ top: 0 });
    railRef.current
      ?.querySelector('[aria-current="true"]')
      ?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selected?.id, all.length]);

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate({ to: "/products", search: { q: query.trim() } });
  };

  // Browse mode is a fixed-height, two-column layout: no page scroll, no dead space.
  const browseH = `calc(100dvh - ${headerH + SEARCH_BAR_H + QUICK_ROW_H}px - ${tabH}px)`;
  const loading = categories.isLoading || subs.isLoading;
  const count = selected ? (counts.data?.[selected.id] ?? 0) : 0;

  return (
    // The storefront shell pads the bottom for the tab bar (pb-36 / md:pb-10). In browse mode the
    // columns already stop at the tab bar, so cancel that padding instead of leaving blank space.
    <div className={cn(!searching && "-mb-36 md:-mb-10")}>
      {/* Search (pinned below the storefront header) */}
      <div
        style={{ top: headerH }}
        className={cn("sticky z-30 bg-tint-mint px-4 py-2.5", searching ? "hairline-b" : "")}
      >
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
          <div className="scrollbar-hide flex h-14 scroll-px-4 items-center gap-2 overflow-x-auto px-4">
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
            <div style={{ height: browseH }} className="flex border-t border-border/50">
              {/* Left rail: every category, listed once. Scrolls on its own. */}
              <nav
                ref={railRef}
                aria-label="Categories"
                className="scrollbar-hide h-full w-[84px] shrink-0 overflow-y-auto overscroll-contain border-r border-border/50 bg-card pb-20 md:w-[120px]"
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
                        "relative flex w-full flex-col items-center gap-1.5 px-1.5 py-2.5 text-center transition-colors",
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

              {/* Right panel: the selected category. Scrolls on its own. */}
              <section
                ref={panelRef}
                className="h-full min-w-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-24 pt-4"
              >
                <h1 className="text-[19px] font-semibold leading-tight tracking-[-0.02em]">
                  {selected.name}
                </h1>
                <p className="mt-1 text-caption text-muted-foreground">
                  {counts.isFetched
                    ? count > 0
                      ? `${count} product${count === 1 ? "" : "s"} near you`
                      : "No products near you yet"
                    : "Checking shops near you…"}
                </p>
                <Link
                  to="/category/$slug"
                  params={{ slug: selected.slug }}
                  className="press mt-3.5 flex h-10 items-center justify-between rounded-xl bg-primary-soft px-3.5 text-meta font-semibold text-primary-ink"
                >
                  View all products
                  <ChevronRight className="h-4 w-4 shrink-0" />
                </Link>

                {selectedSubs.length > 0 ? (
                  <>
                    <h2 className="mb-3 mt-6 text-caption font-semibold uppercase tracking-[0.06em] text-muted-foreground">
                      Shop by type
                    </h2>
                    <div className="grid grid-cols-3 gap-x-3 gap-y-5 md:grid-cols-5 lg:grid-cols-6">
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
                  </>
                ) : (
                  <p className="mt-6 text-center text-caption text-muted-foreground">
                    No subcategories yet. Tap the button above to see everything in {selected.name}.
                  </p>
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
