import { createFileRoute, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";

import { lazy, Suspense, useEffect, useMemo, useState } from "react";
import { Zap, Clock, Truck, ShieldCheck, SlidersHorizontal, X } from "lucide-react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, Pagination } from "swiper/modules";
import "swiper/css";
import "swiper/css/pagination";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { MobileHeroScene } from "@/components/MobileHeroScene";
import { useAuth } from "@/hooks/useAuth";
import { useIsMobile } from "@/hooks/use-mobile";

// three.js is ~1 MB: load it only on wide screens where the 3D hero is shown.
const Hero3D = lazy(() => import("@/components/Hero3D").then((m) => ({ default: m.Hero3D })));

import offer1 from "@/assets/offer-1.jpg";
import offer2 from "@/assets/offer-2.jpg";
import offer3 from "@/assets/offer-3.jpg";
import offer4 from "@/assets/offer-4.jpg";
import offer5 from "@/assets/offer-5.jpg";
import offer6 from "@/assets/offer-6.jpg";
import { StorageImg } from "@/components/StorageImg";

type SortKey = "relevance" | "price-asc" | "price-desc" | "rating" | "discount";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AP Mart — Groceries in 10 minutes" },
      { name: "description", content: "Order groceries, snacks, fruits and household essentials delivered in 10 minutes." },
    ],
  }),
  component: HomePage,
});

function HomePage() {
  const { user, roles, loading, rolesLoading } = useAuth();
  const isMobile = useIsMobile();
  // Decide after mount (same markup on server and first client render), and
  // never mount WebGL on phones or in the Android app.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const showHero3D = mounted && !isMobile;

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, slug, name, icon, color, display_order")
        .eq("is_active", true)
        .order("display_order");
      return data ?? [];
    },
    // Static catalog data — cache aggressively to avoid refetch chatter.
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });


  const featured = useQuery({
    queryKey: ["products", "featured"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, slug, name, unit, price, mrp, image_url, delivery_minutes, stock")
        .eq("is_featured", true)
        .limit(12);
      return (data ?? []) as ProductCardData[];
    },
  });

  const bestsellers = useQuery({
    queryKey: ["products", "bestsellers"],
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("id, slug, name, unit, price, mrp, image_url, delivery_minutes, stock")
        .eq("is_bestseller", true)
        .limit(12);
      return (data ?? []) as ProductCardData[];
    },
  });

  if (!loading && !rolesLoading && user) {
    const r: string[] = roles ?? [];
    if (r.includes("shopkeeper")) return <Navigate to="/shopkeeper/dashboard" replace />;
    if (r.includes("delivery")) return <Navigate to="/delivery/dashboard" replace />;
    if (r.includes("admin")) return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/customer/home" replace />;
  }

  return (
    <div>
      {/* HERO */}
      {!user && (
      <section className="relative overflow-hidden">
        {/* Animated aurora background */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 gradient-aurora" />
          <motion.div
            aria-hidden
            className="absolute -top-32 -left-32 h-[28rem] w-[28rem] rounded-full blur-3xl opacity-50"
            style={{ background: "radial-gradient(circle, #84CC16 0%, transparent 70%)" }}
            animate={{ x: [0, 60, 0], y: [0, 40, 0] }}
            transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            aria-hidden
            className="absolute -bottom-32 -right-32 h-[32rem] w-[32rem] rounded-full blur-3xl opacity-40"
            style={{ background: "radial-gradient(circle, #F59E0B 0%, transparent 70%)" }}
            animate={{ x: [0, -50, 0], y: [0, -30, 0] }}
            transition={{ duration: 16, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          />
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.08]"
            style={{
              backgroundImage: "radial-gradient(circle, #0F172A 1px, transparent 1px)",
              backgroundSize: "22px 22px",
            }}
          />
        </div>

        <div className="relative mx-auto max-w-7xl px-4 py-10 md:py-20 grid md:grid-cols-2 gap-8 md:gap-10 items-center">

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-3 py-1 text-xs font-semibold shadow-float">
              <motion.span
                animate={{ scale: [1, 1.25, 1] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Zap className="h-3 w-3 fill-primary text-primary" />
              </motion.span>
              Delivery promise: 10 minutes
            </div>
            <h1 className="mt-4 font-display text-5xl md:text-7xl font-extrabold leading-[0.95] text-balance">
              Groceries at{" "}
              <span className="relative inline-block">
                <span className="relative z-10 bg-gradient-to-r from-[#65A30D] via-[#84CC16] to-[#F59E0B] bg-clip-text text-transparent">
                  lightning
                </span>
                <motion.span
                  aria-hidden
                  className="absolute -inset-1 -z-0 rounded-2xl blur-xl opacity-60"
                  style={{ background: "linear-gradient(90deg, #84CC16, #F59E0B)" }}
                  animate={{ opacity: [0.4, 0.7, 0.4] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                />
              </span>{" "}
              speed.
            </h1>
            <p className="mt-4 text-lg text-muted-foreground max-w-md">
              Fresh fruits, daily essentials, snacks and more — at your door before you finish your coffee.
            </p>
            <div className="mt-6 flex flex-wrap gap-3">
              <Link
                to="/products"
                className="rounded-xl gradient-primary px-6 py-3 font-bold text-primary-foreground shadow-glow hover:opacity-95 hover:-translate-y-0.5 transition-all"
              >
                Shop now
              </Link>
              <Link
                to="/products"
                className="rounded-xl border-2 border-foreground bg-background/60 backdrop-blur px-6 py-3 font-bold hover:bg-foreground hover:text-background transition"
              >
                Browse categories
              </Link>
            </div>

            <div className="mt-8 grid grid-cols-3 gap-3 max-w-md">
              <Feature icon={<Clock className="h-5 w-5" />} label="Lightning fast" />
              <Feature icon={<Truck className="h-5 w-5" />} label="Free above ₹199" />
              <Feature icon={<ShieldCheck className="h-5 w-5" />} label="100% authentic" />
            </div>

            {/* Mobile-only floating 3D scene below the headline */}
            <div className="md:hidden mt-8">
              <MobileHeroScene />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.7, delay: 0.1 }}
            className="relative aspect-square hidden md:block"
          >
            {showHero3D && (
              <Suspense fallback={null}>
                <Hero3D />
              </Suspense>
            )}
          </motion.div>
        </div>
      </section>
      )}

      {/* OFFER BANNERS */}
      <OfferBannersCarousel />

      {/* CATEGORIES */}
      <section className="mx-auto max-w-7xl px-4 py-10">
        <h2 className="font-display text-2xl md:text-3xl font-bold mb-4">Shop by category</h2>
        <div className="md:hidden -mx-4 px-4 overflow-x-auto no-scrollbar snap-x snap-mandatory">
          <div className="flex gap-3 pb-2">
            {categories.isLoading
              ? Array.from({ length: 10 }).map((_, i) => (
                  <Skeleton key={i} className="w-[28%] shrink-0 aspect-square rounded-2xl" />
                ))
              : categories.data?.map((c) => (
                  <Link
                    key={c.id}
                    to="/category/$slug"
                    params={{ slug: c.slug }}
                    className="snap-start group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-card transition-all w-[28%] shrink-0"
                  >
                    <div
                      className="grid h-12 w-12 place-items-center rounded-xl text-2xl"
                      style={{ backgroundColor: (c.color ?? "#A3E635") + "55" }}
                    >
                      {c.icon}
                    </div>
                    <div className="text-[11px] text-center font-medium leading-tight line-clamp-2">{c.name}</div>
                  </Link>
                ))}
          </div>
        </div>
        <div className="hidden md:grid grid-cols-5 lg:grid-cols-10 gap-3">
          {categories.isLoading
            ? Array.from({ length: 10 }).map((_, i) => (
                <Skeleton key={i} className="aspect-square rounded-2xl" />
              ))
            : categories.data?.map((c) => (
                <Link
                  key={c.id}
                  to="/category/$slug"
                  params={{ slug: c.slug }}
                  className="group flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-card hover:shadow-glow hover:-translate-y-1 transition-all"
                >
                  <div
                    className="grid h-14 w-14 place-items-center rounded-xl text-3xl"
                    style={{ backgroundColor: (c.color ?? "#A3E635") + "55" }}
                  >
                    {c.icon}
                  </div>
                  <div className="text-xs text-center font-medium leading-tight">{c.name}</div>
                </Link>
              ))}
        </div>
      </section>


      {/* CATALOG FILTERS */}
      <CatalogFilters categories={categories.data ?? []} />

      {/* FEATURED */}
      <ProductSection title="✨ Featured today" query={featured} />
      <ProductSection title="🔥 Bestsellers" query={bestsellers} />
    </div>
  );
}

function CatalogFilters({ categories }: { categories: Array<{ id: string; slug: string; name: string; icon: string | null }> }) {
  const [activeCat, setActiveCat] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("relevance");
  const [maxPrice, setMaxPrice] = useState<number>(1000);
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);
  const [inStock, setInStock] = useState(false);
  const [open, setOpen] = useState(false);

  const collections = useQuery({
    queryKey: ["home-collections"],
    queryFn: async () =>
      (await supabase.from("collections").select("id, slug, name").eq("is_active", true).order("display_order")).data ?? [],
  });
  const [activeColl, setActiveColl] = useState<string | null>(null);

  const products = useQuery({
    queryKey: ["catalog", activeCat, activeColl, sort, maxPrice, onlyDiscounted, inStock],
    queryFn: async () => {
      let ids: string[] | null = null;
      if (activeColl) {
        const { data: pc } = await supabase
          .from("product_collections")
          .select("product_id")
          .eq("collection_id", activeColl);
        ids = (pc ?? []).map((r) => r.product_id);
        if (ids.length === 0) return [];
      }
      if (activeCat) {
        const { data: catLinks } = await (supabase as any)
          .from("product_categories")
          .select("product_id")
          .eq("category_id", activeCat);
        const catIds = ((catLinks ?? []) as { product_id: string }[]).map((r) => r.product_id);
        ids = ids ? ids.filter((id) => catIds.includes(id)) : catIds;
        if (ids.length === 0) return [];
      }
      let qb = supabase
        .from("products")
        .select("id, slug, name, unit, price, mrp, image_url, delivery_minutes, stock, rating, category_id");
      if (ids) qb = qb.in("id", ids);
      if (maxPrice < 1000) qb = qb.lte("price", maxPrice);
      if (inStock) qb = qb.gt("stock", 0);
      if (sort === "price-asc") qb = qb.order("price", { ascending: true });
      else if (sort === "price-desc") qb = qb.order("price", { ascending: false });
      else if (sort === "rating") qb = qb.order("rating", { ascending: false });
      const { data } = await qb.limit(60);
      let rows = (data ?? []) as ProductCardData[];
      if (onlyDiscounted) rows = rows.filter((p) => Number(p.mrp) > Number(p.price));
      if (sort === "discount")
        rows = [...rows].sort(
          (a, b) => (Number(b.mrp) - Number(b.price)) / Number(b.mrp || 1) - (Number(a.mrp) - Number(a.price)) / Number(a.mrp || 1),
        );
      return rows;
    },
  });

  const activeCount = useMemo(
    () => [activeCat, activeColl, onlyDiscounted, inStock, sort !== "relevance", maxPrice < 1000].filter(Boolean).length,
    [activeCat, activeColl, onlyDiscounted, inStock, sort, maxPrice],
  );

  const reset = () => {
    setActiveCat(null);
    setActiveColl(null);
    setSort("relevance");
    setMaxPrice(1000);
    setOnlyDiscounted(false);
    setInStock(false);
  };

  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-center justify-between mb-4 gap-2">
        <h2 className="font-display text-2xl md:text-3xl font-bold">🛍️ Browse catalog</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-bold shadow-card"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Filters {activeCount > 0 && <span className="ml-1 rounded-full gradient-primary text-primary-foreground px-1.5 text-[10px]">{activeCount}</span>}
        </button>
      </div>

      {/* Category chips */}
      <div className="-mx-4 px-4 overflow-x-auto no-scrollbar pb-2">
        <div className="flex gap-2 w-max">
          <Chip active={!activeCat} onClick={() => setActiveCat(null)}>All</Chip>
          {categories.map((c) => (
            <Chip key={c.id} active={activeCat === c.id} onClick={() => setActiveCat(activeCat === c.id ? null : c.id)}>
              <span>{c.icon}</span> {c.name}
            </Chip>
          ))}
        </div>
      </div>

      {/* Advanced filters drawer */}
      {open && (
        <div className="mt-3 rounded-2xl border border-border bg-card shadow-card flex flex-col max-h-[70vh]">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <span className="font-bold text-sm">Refine results</span>
            <button
              onClick={() => setOpen(false)}
              className="inline-flex items-center justify-center h-8 w-8 rounded-full bg-muted hover:bg-muted/80 transition"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sort by</label>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["relevance", "price-asc", "price-desc", "rating", "discount"] as SortKey[]).map((s) => (
                  <Chip key={s} active={sort === s} onClick={() => setSort(s)}>
                    {s === "relevance" ? "Relevance" : s === "price-asc" ? "Price ↑" : s === "price-desc" ? "Price ↓" : s === "rating" ? "Top rated" : "Best discount"}
                  </Chip>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Max price</label>
                <span className="text-xs font-bold">{maxPrice >= 1000 ? "Any" : `₹${maxPrice}`}</span>
              </div>
              <input
                type="range"
                min={50}
                max={1000}
                step={50}
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="mt-2 w-full accent-primary"
              />
            </div>

            {collections.data && collections.data.length > 0 && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Collection</label>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Chip active={!activeColl} onClick={() => setActiveColl(null)}>Any</Chip>
                  {collections.data.map((c) => (
                    <Chip key={c.id} active={activeColl === c.id} onClick={() => setActiveColl(activeColl === c.id ? null : c.id)}>
                      {c.name}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              <Chip active={onlyDiscounted} onClick={() => setOnlyDiscounted((v) => !v)}>% Discounted only</Chip>
              <Chip active={inStock} onClick={() => setInStock((v) => !v)}>In stock</Chip>
            </div>
          </div>

          {/* Sticky action bar */}
          <div className="flex items-center justify-between gap-3 p-4 border-t border-border bg-card/95 backdrop-blur-sm">
            <button
              onClick={reset}
              className="rounded-full border border-border bg-card px-4 py-2 text-xs font-bold hover:bg-muted transition inline-flex items-center gap-1"
            >
              <X className="h-3 w-3" /> Reset
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded-full gradient-primary px-6 py-2 text-xs font-bold text-primary-foreground shadow-glow hover:opacity-95 transition"
            >
              Apply
            </button>
          </div>
        </div>
      )}

      {/* Results */}
      <div className="mt-4">
        {products.isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)}
          </div>
        ) : products.data?.length === 0 ? (
          <div className="text-center py-12 rounded-2xl border border-dashed border-border">
            <div className="text-5xl">🛒</div>
            <p className="mt-2 text-sm text-muted-foreground">No products match your filters.</p>
            <button onClick={reset} className="mt-3 rounded-full gradient-primary px-4 py-2 text-xs font-bold text-primary-foreground">
              Clear filters
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
            {products.data?.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </section>
  );
}

function Chip({ active, onClick, children }: { active?: boolean; onClick?: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`shrink-0 inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-bold transition ${
        active
          ? "gradient-primary text-primary-foreground border-transparent shadow-glow"
          : "border-border bg-card hover:bg-muted"
      }`}
    >
      {children}
    </button>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex flex-col items-center gap-1 rounded-xl bg-card border border-border p-3 text-center shadow-card">
      <div className="text-primary">{icon}</div>
      <div className="text-[11px] font-semibold leading-tight">{label}</div>
    </div>
  );
}

function ProductSection({
  title,
  query,
}: {
  title: string;
  query: ReturnType<typeof useQuery<ProductCardData[]>>;
}) {
  return (
    <section className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-display text-2xl md:text-3xl font-bold">{title}</h2>
        <Link to="/products" className="text-sm font-semibold text-primary hover:underline">
          See all →
        </Link>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {query.isLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
            ))
          : query.data?.map((p) => <ProductCard key={p.id} product={p} />)}
      </div>
    </section>
  );
}

type OfferRow = {
  id: string;
  title: string;
  subtitle: string | null;
  image_url: string;
  link_url: string | null;
  badge: string | null;
  scope: "global" | "shop";
};

const STATIC_OFFERS: OfferRow[] = [
  {
    id: "1",
    title: "Weekend Sale",
    subtitle: "Up to 70% off on fresh produce",
    image_url: offer1,
    link_url: "/products",
    badge: "70% OFF",
    scope: "global",
  },
  {
    id: "2",
    title: "BOGO Deal",
    subtitle: "Buy 1 Get 1 Free on dairy",
    image_url: offer2,
    link_url: "/products",
    badge: "B1G1",
    scope: "global",
  },
  {
    id: "3",
    title: "Snack Fiesta",
    subtitle: "Flat 50% off on all snacks",
    image_url: offer3,
    link_url: "/products",
    badge: "50% OFF",
    scope: "global",
  },
  {
    id: "4",
    title: "Farm Fresh",
    subtitle: "40% off on vegetables",
    image_url: offer4,
    link_url: "/products",
    badge: "40% OFF",
    scope: "global",
  },
  {
    id: "5",
    title: "Daily Essentials",
    subtitle: "Big savings on household items",
    image_url: offer5,
    link_url: "/products",
    badge: "SAVE BIG",
    scope: "global",
  },
  {
    id: "6",
    title: "Summer Special",
    subtitle: "60% off on fruits & juices",
    image_url: offer6,
    link_url: "/products",
    badge: "60% OFF",
    scope: "global",
  },
];

function OfferBannersCarousel() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-6">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-display text-lg md:text-xl font-bold">🎁 Offers & deals</h2>
      </div>

      <Swiper
        modules={[Autoplay, Pagination]}
        loop={STATIC_OFFERS.length > 1}
        spaceBetween={12}
        autoplay={{ delay: 3500, disableOnInteraction: false, pauseOnMouseEnter: true }}
        pagination={{ clickable: true, dynamicBullets: true }}
        breakpoints={{
          0: { slidesPerView: 1.1 },
          640: { slidesPerView: 2 },
          768: { slidesPerView: 3 },
          1024: { slidesPerView: 4 },
        }}
        className="!pb-8"
      >
        {STATIC_OFFERS.map((o) => {
          const href = o.link_url || "/";
          const img = (
            <div className="relative rounded-2xl overflow-hidden shadow-md hover:shadow-glow transition-shadow border border-border bg-card">
              <StorageImg
                src={o.image_url}
                alt={o.title}
                loading="lazy"
                className="w-full h-28 sm:h-32 md:h-36 object-cover"
              />
              {o.badge && (
                <span className="absolute top-2 left-2 rounded-full gradient-primary text-primary-foreground text-[10px] font-bold px-2 py-0.5 shadow-glow">
                  {o.badge}
                </span>
              )}
            </div>
          );
          return (
            <SwiperSlide key={o.id}>
              {href.startsWith("/") ? (
                <Link to={href as any} className="block">{img}</Link>
              ) : (
                <a href={href} target="_blank" rel="noreferrer" className="block">{img}</a>
              )}
            </SwiperSlide>
          );
        })}
      </Swiper>
    </section>
  );
}
