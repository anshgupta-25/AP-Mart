import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Search, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { loadProductCategoriesMap } from "@/lib/productCategories";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
import { StorageImg } from "@/components/StorageImg";


const search = z.object({ q: z.string().optional(), chip: z.string().optional() });

export const Route = createFileRoute("/customer/categories")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "Shop by category — AP Mart" }] }),
  component: CategoriesBrowse,
});

const CHIPS = [
  { key: "popular", label: "Popular", emoji: "🔥" },
  { key: "offers", label: "Offers", emoji: "🏷️" },
  { key: "organic", label: "Organic", emoji: "🌱" },
  { key: "new", label: "New", emoji: "✨" },
  { key: "fast", label: "Fast Delivery", emoji: "⚡" },
  { key: "summer", label: "Summer", emoji: "☀️" },
  { key: "trending", label: "Trending", emoji: "📈" },
  { key: "healthy", label: "Healthy", emoji: "🥗" },
  { key: "imported", label: "Imported", emoji: "🌍" },
];

const TILE_GRADIENTS = [
  "from-lime-100 via-white to-emerald-50",
  "from-amber-100 via-white to-orange-50",
  "from-rose-100 via-white to-pink-50",
  "from-sky-100 via-white to-blue-50",
  "from-violet-100 via-white to-fuchsia-50",
  "from-yellow-100 via-white to-lime-50",
  "from-teal-100 via-white to-cyan-50",
  "from-orange-100 via-white to-red-50",
];

const SUBTITLES: Record<string, string> = {
  dairy: "Milk • Cheese • Butter",
  "cold-drinks": "Juices • Soft Drinks • Energy",
  fruits: "Fresh & Organic",
  vegetables: "Fresh & Organic",
  snacks: "Chips • Biscuits • Namkeen",
  grains: "Rice • Atta • Pulses",
  chocolates: "Sweets & Treats",
  instant: "Ready to eat",
  meat: "Fresh cuts daily",
  spices: "Masala & seasoning",
  breakfast: "Cereals • Oats • Muesli",
  cleaning: "Household essentials",
  personal: "Care & hygiene",
  beauty: "Skin • Hair • Makeup",
  baby: "Care for little ones",
  pet: "Food & accessories",
  frozen: "Ice cream & more",
  tea: "Tea • Coffee • Beverages",
};

function subtitleFor(slug: string, name: string) {
  const key = Object.keys(SUBTITLES).find((k) => slug.includes(k) || name.toLowerCase().includes(k));
  return key ? SUBTITLES[key] : "Explore fresh picks";
}

function CategoriesBrowse() {
  const { q: qParam, chip } = Route.useSearch();
  const navigate = useNavigate();
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
      const { data } = await (supabase as any).rpc("list_customer_products", {
        _pincode: pincode,
        _category_id: null,
        _search: null,
        _only_featured: false,
        _only_bestseller: false,
        _sort: "relevance",
        _limit: 1000,
        _ids: null,
      });
      const rows = (data ?? []) as any[];
      const ids = rows.map((r) => r.id);
      const linkMap = await loadProductCategoriesMap(ids);
      const map: Record<string, number> = {};
      rows.forEach((r: any) => {
        const cats = linkMap[r.id]?.length ? linkMap[r.id] : (r.category_id ? [r.category_id] : []);
        new Set(cats).forEach((cid) => { map[cid] = (map[cid] ?? 0) + 1; });
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

  const onSubmitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) navigate({ to: "/products", search: { q: query.trim() } as any });
  };

  return (
    <div className="relative pb-8">
      {/* Aurora glow background */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 gradient-aurora opacity-70" />

      <div className="relative">
        {/* Header */}
        <div className="px-4 pt-5 pb-3">
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary/90">
            <Sparkles className="h-3.5 w-3.5" />
            Shop by category
          </div>
          <h1 className="mt-1 font-display text-[26px] font-extrabold leading-tight">
            What are we <span className="text-primary">bringing</span> you today?
          </h1>
        </div>

        {/* Glass search bar */}
        <div className="px-4">
          <form
            onSubmit={onSubmitSearch}
            className="glass flex items-center gap-2 rounded-3xl border border-white/60 px-3.5 py-3 shadow-card-premium"
          >
            <Search className="h-5 w-5 text-primary shrink-0" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search categories, products…"
              className="flex-1 min-w-0 bg-transparent text-[14px] font-medium placeholder:text-muted-foreground focus:outline-none"
            />
          </form>

        </div>

        {/* Quick action chips */}
        <div className="mt-4 -mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 w-max">
            {CHIPS.map((c) => {
              const active = chip === c.key;
              return (
                <motion.button
                  key={c.key}
                  whileTap={{ scale: 0.94 }}
                  onClick={() =>
                    navigate({ search: { chip: active ? undefined : c.key } as any })
                  }
                  className={`shrink-0 inline-flex items-center gap-1.5 rounded-full px-3.5 py-2 text-[12px] font-bold border transition-all ${
                    active
                      ? "gradient-primary text-primary-foreground border-transparent shadow-glow"
                      : "glass border-white/70 text-foreground/80 hover:text-foreground"
                  }`}
                >
                  <span className="text-sm">{c.emoji}</span>
                  {c.label}
                </motion.button>
              );
            })}
          </div>
        </div>

        {/* Category grid */}
        <div className="mt-6 px-4">
          <div className="flex items-baseline justify-between mb-3">
            <h2 className="font-display text-[18px] font-extrabold">All categories</h2>
            <span className="text-[11px] text-muted-foreground font-semibold">
              {filtered.length} sections
            </span>
          </div>

          {categories.isLoading ? (
            <div className="grid grid-cols-2 gap-3">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="aspect-[5/4] rounded-3xl shimmer" />
              ))}
            </div>
          ) : categories.isError && !categories.data ? (
            <div className="rounded-3xl border border-border bg-card py-10 text-center px-6">
              <p className="text-sm text-muted-foreground">Couldn’t load categories.</p>
              <button
                onClick={() => categories.refetch()}
                className="mt-3 rounded-full gradient-primary text-primary-foreground px-5 py-2 text-[12px] font-extrabold"
              >
                Try again
              </button>
            </div>
          ) : filtered.length === 0 ? (
            <EmptyState onReset={() => setQuery("")} />
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((c, idx) => {
                  const count = counts.data?.[c.id] ?? 0;
                  const grad = TILE_GRADIENTS[idx % TILE_GRADIENTS.length];
                  return (
                    <motion.div
                      key={c.id}
                      layout
                      initial={{ opacity: 0, y: 14 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ delay: Math.min(idx * 0.03, 0.25), type: "spring", stiffness: 260, damping: 22 }}
                      whileHover={{ y: -3 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Link
                        to="/category/$slug"
                        params={{ slug: c.slug }}
                        className="group relative block h-full overflow-hidden rounded-3xl border border-white/70 shadow-card-premium"
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${grad}`} />
                        <div className="absolute -top-6 -right-6 h-24 w-24 rounded-full bg-white/50 blur-2xl" />
                        <div className="relative p-3.5 flex flex-col h-full min-h-[142px]">
                          <div className="flex items-start justify-between">
                            <motion.div
                              whileHover={{ rotate: -6, scale: 1.06 }}
                              transition={{ type: "spring", stiffness: 300 }}
                              className="h-14 w-14 rounded-2xl bg-white/80 backdrop-blur border border-white grid place-items-center text-3xl shadow-soft"
                            >
                              {c.icon ?? "🛍️"}
                            </motion.div>
                            <div className="rounded-full bg-white/70 backdrop-blur px-2 py-0.5 text-[10px] font-bold text-foreground/70 border border-white">
                              {count}
                            </div>
                          </div>
                          <div className="mt-auto pt-3">
                            <div className="font-display text-[14px] font-extrabold leading-tight line-clamp-1">
                              {c.name}
                            </div>
                            <div className="mt-0.5 flex items-center justify-between gap-2">
                              <div className="text-[10.5px] text-foreground/60 font-medium line-clamp-1">
                                {subtitleFor(c.slug, c.name)}
                              </div>
                              <motion.div
                                initial={{ x: 0 }}
                                whileHover={{ x: 3 }}
                                className="h-6 w-6 grid place-items-center rounded-full gradient-primary text-primary-foreground shadow-glow shrink-0"
                              >
                                <ArrowRight className="h-3.5 w-3.5" />
                              </motion.div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Featured collections */}
        {collections.data && collections.data.length > 0 && (
          <div className="mt-8 px-4">
            <div className="flex items-baseline justify-between mb-3">
              <h2 className="font-display text-[18px] font-extrabold">Featured collections</h2>
              <Link to="/products" className="text-[12px] font-bold text-primary inline-flex items-center gap-0.5">
                See all <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
            <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
              <div className="flex gap-3 w-max">
                {collections.data.map((col: any, i: number) => (
                  <motion.div key={col.id} whileTap={{ scale: 0.97 }} whileHover={{ y: -2 }}>
                    <Link
                      to="/products"
                      search={{ q: col.name } as any}
                      className={`relative block w-[220px] h-[110px] rounded-3xl overflow-hidden border border-white/70 shadow-card-premium bg-gradient-to-br ${TILE_GRADIENTS[(i + 2) % TILE_GRADIENTS.length]}`}
                    >
                      {col.image_url && (
                        <StorageImg
                          src={col.image_url}
                          alt=""
                          className="absolute inset-0 h-full w-full object-cover opacity-70"
                          loading="lazy"
                        />
                      )}
                      <div className="absolute inset-0 bg-gradient-to-tr from-black/40 via-transparent to-transparent" />
                      <div className="relative h-full p-3 flex flex-col justify-end text-white">
                        <div className="font-display text-[15px] font-extrabold leading-tight drop-shadow">
                          {col.name}
                        </div>
                        {col.description && (
                          <div className="text-[10.5px] opacity-90 line-clamp-1 drop-shadow">{col.description}</div>
                        )}
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div className="rounded-3xl border border-white/70 glass shadow-card-premium py-12 grid place-items-center text-center px-6">
      <div className="text-6xl">🧺</div>
      <div className="mt-3 font-display text-lg font-extrabold">No categories match</div>
      <div className="text-[12px] text-muted-foreground mt-1">Try another keyword or explore everything.</div>
      <button
        onClick={onReset}
        className="mt-4 rounded-full gradient-primary text-primary-foreground px-5 py-2 text-[12px] font-extrabold shadow-glow"
      >
        Explore More
      </button>
    </div>
  );
}
