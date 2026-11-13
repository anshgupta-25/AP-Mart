import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { type ProductCardData } from "@/components/ProductCard";
import { ProductRail } from "@/components/customer/ProductRail";
import { HeroBannerCarousel } from "@/components/customer/HeroBannerCarousel";
import { CategoryGroups } from "@/components/customer/CategoryGroups";
import { BackToTop } from "@/components/customer/BackToTop";
import { CollectionChips } from "@/components/customer/CatalogFilters";
import type { CategoryLite } from "@/components/customer/CategoryGrid";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "AP Mart — Groceries from shops near you" },
      {
        name: "description",
        content:
          "Order groceries, snacks, fruits and household essentials from trusted local shops near you.",
      },
    ],
  }),
  component: HomePage,
});

const COLS = "id, slug, name, unit, price, mrp, image_url, delivery_minutes, stock";

function useProducts(key: string, build: (q: any) => any) {
  return useQuery({
    queryKey: ["public-products", key],
    staleTime: 60_000,
    queryFn: async () => {
      const { data } = await build(supabase.from("products").select(COLS).gt("stock", 0).limit(12));
      return (data ?? []) as ProductCardData[];
    },
  });
}

function HomePage() {
  const { user, roles, loading, rolesLoading } = useAuth();

  const categories = useQuery({
    queryKey: ["app-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("id, slug, name, icon, color, image_url")
        .eq("is_active", true)
        .order("display_order");
      return (data ?? []) as CategoryLite[];
    },
    staleTime: 10 * 60 * 1000,
  });

  const featured = useProducts("featured", (q) => q.eq("is_featured", true));
  const deals = useProducts("deals", (q) => q.order("price", { ascending: true }));
  const bestsellers = useProducts("bestsellers", (q) => q.eq("is_bestseller", true));

  if (!loading && !rolesLoading && user) {
    const r: string[] = roles ?? [];
    if (r.includes("shopkeeper")) return <Navigate to="/shopkeeper/dashboard" replace />;
    if (r.includes("delivery")) return <Navigate to="/delivery/dashboard" replace />;
    if (r.includes("admin")) return <Navigate to="/admin/dashboard" replace />;
    return <Navigate to="/customer/home" replace />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 pb-8 pt-3">
      <HeroBannerCarousel />
      <CollectionChips />
      <ProductRail
        title="Featured this week"
        loading={featured.isLoading}
        products={featured.data}
      />
      <CategoryGroups categories={categories.data} from={0} count={2} />
      <ProductRail title="Great prices" loading={deals.isLoading} products={deals.data} />
      <CategoryGroups categories={categories.data} from={2} count={3} />
      <ProductRail
        title="Popular near you"
        loading={bestsellers.isLoading}
        products={bestsellers.data}
      />
      <BackToTop />
    </div>
  );
}
