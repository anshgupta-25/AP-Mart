import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Clock, ShieldCheck, Truck, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { HeroBannerCarousel } from "@/components/customer/HeroBannerCarousel";
import { QuickServices } from "@/components/customer/QuickServices";
import { CategoryGrid, type CategoryLite } from "@/components/customer/CategoryGrid";
import { ProductRail } from "@/components/customer/ProductRail";
import { useCustomerProducts } from "@/hooks/useCustomerProducts";
import { useDeliveryContext, useEligibleShopCount } from "@/hooks/useDeliveryContext";
import { NoShopsNotice } from "@/components/customer/NoShopsNotice";

export const Route = createFileRoute("/customer/home")({
  head: () => ({
    meta: [
      { title: "AP Mart — 10-min grocery delivery" },
      { name: "description", content: "Fresh groceries, snacks and daily essentials delivered to your door in 10 minutes." },
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
      const { data } = await supabase.from("categories").select("id, slug, name, icon, color, image_url").eq("is_active", true).order("display_order");
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
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="space-y-6 pt-4"
    >
      <HeroBannerCarousel />

      {/* Promise strip */}
      <div className="px-4 grid grid-cols-3 gap-2">
        <Promise icon={<Clock className="h-4 w-4" />} label="10-min" sub="delivery" />
        <Promise icon={<Truck className="h-4 w-4" />} label="Free" sub="above ₹199" />
        <Promise icon={<ShieldCheck className="h-4 w-4" />} label="100%" sub="authentic" />
      </div>

      {/* Quick services */}
      <SectionHeader title="Shop in seconds" emoji="⚡" />
      <QuickServices />

      {/* Categories grid */}
      <SectionHeader title="Categories" emoji="🛍️" subtitle="Pick what you need" />
      <CategoryGrid categories={categories.data} loading={categories.isLoading} />

      {/* Deals */}
      <ProductRail
        title="Best deals today"
        emoji="🔥"
        subtitle="Lowest prices on essentials"
        loading={!deals.data}
        products={deals.data}
      />

      {/* Featured banner strip */}
      <div className="px-4">
        <div className="rounded-2xl overflow-hidden gradient-banner-night text-white p-4 flex items-center gap-3 shadow-card">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-white/15 backdrop-blur">
            <Zap className="h-6 w-6 fill-accent text-accent" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-display font-extrabold leading-tight">Late-night cravings?</div>
            <div className="text-[12px] opacity-90">We deliver till 2 AM in your area</div>
          </div>
        </div>
      </div>

      {/* Trending */}
      <ProductRail
        title="Trending near you"
        emoji="📈"
        subtitle="Most ordered this week"
        loading={!bestsellers.data}
        products={bestsellers.data}
      />

      {/* Recommended */}
      <ProductRail
        title="Recommended for you"
        emoji="⭐"
        subtitle="Picked just for you"
        loading={!featured.data}
        products={featured.data}
      />

      {/* Bottom safe area is handled by parent pb-32 + floating cart */}
      <div className="px-4 pt-2 text-center text-[11px] text-muted-foreground">
        AP Mart · Delivered with ⚡
      </div>
    </motion.div>
  );
}

function SectionHeader({ title, emoji, subtitle }: { title: string; emoji?: string; subtitle?: string }) {
  return (
    <div className="px-4">
      <h2 className="font-display text-[17px] font-extrabold leading-tight flex items-center gap-1.5">
        {emoji && <span className="text-xl">{emoji}</span>}
        <span>{title}</span>
      </h2>
      {subtitle && <p className="text-[11px] text-muted-foreground">{subtitle}</p>}
    </div>
  );
}

function Promise({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-2 rounded-2xl bg-card border border-border p-2.5 shadow-soft">
      <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">{icon}</span>
      <div className="leading-tight min-w-0">
        <div className="text-[12px] font-extrabold truncate">{label}</div>
        <div className="text-[10px] text-muted-foreground truncate">{sub}</div>
      </div>
    </div>
  );
}
