import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { HeroBannerCarousel } from "@/components/customer/HeroBannerCarousel";
import { type CategoryLite } from "@/components/customer/CategoryGrid";
import { CategoryGroups } from "@/components/customer/CategoryGroups";
import { BackToTop } from "@/components/customer/BackToTop";
import { CollectionChips } from "@/components/customer/CatalogFilters";
import { ProductRail } from "@/components/customer/ProductRail";
import { useCustomerProducts } from "@/hooks/useCustomerProducts";
import { useDeliveryContext, useEligibleShopCount } from "@/hooks/useDeliveryContext";
import { NoShopsNotice } from "@/components/customer/NoShopsNotice";

export const Route = createFileRoute("/customer/home")({
  head: () => ({
    meta: [
      { title: "AP Mart — Groceries from shops near you" },
      {
        name: "description",
        content: "Order groceries, snacks and daily essentials from trusted local shops near you.",
      },
    ],
  }),
  component: CustomerHome,
});

function CustomerHome() {
  const { refresh } = useDeliveryContext();
  const eligibleShops = useEligibleShopCount();

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
  });

  const featured = useCustomerProducts({ onlyFeatured: true, limit: 10, key: "featured" });
  const bestsellers = useCustomerProducts({ onlyBestseller: true, limit: 10, key: "best" });
  const deals = useCustomerProducts({ sort: "price_asc", limit: 10, key: "deals" });

  if (eligibleShops.isSuccess && eligibleShops.data === 0) {
    return (
      <NoShopsNotice
        onRefresh={() => {
          refresh();
          eligibleShops.refetch();
        }}
      />
    );
  }

  return (
    <div className="space-y-6 pt-4">
      <HeroBannerCarousel />
      <CollectionChips />

      <ProductRail title="Featured this week" loading={!featured.data} products={featured.data} />

      <CategoryGroups categories={categories.data} from={0} count={2} />

      <ProductRail title="Great prices" loading={!deals.data} products={deals.data} />

      <CategoryGroups categories={categories.data} from={2} count={3} />

      <ProductRail
        title="Popular near you"
        loading={!bestsellers.data}
        products={bestsellers.data}
      />

      <BackToTop />
    </div>
  );
}
