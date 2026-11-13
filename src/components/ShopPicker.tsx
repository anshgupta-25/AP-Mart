import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, MapPin, Clock, Zap, TrendingDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { rpcArgs } from "@/integrations/supabase/rpc";

export type EligibleShop = {
  shop_id: string;
  shop_name: string;
  shop_address: string | null;
  latitude: number | null;
  longitude: number | null;
  pincode: string | null;
  service_radius_km: number | null;
  distance_km: number | null;
  delivery_minutes: number;
  price: number;
  mrp: number;
  stock: number;
};

export function useEligibleShops(params: {
  productId: string | undefined;
  variantId?: string | null;
  pincode?: string | null;
  lat?: number | null;
  lng?: number | null;
  enabled?: boolean;
}) {
  const { productId, variantId, pincode, lat, lng, enabled = true } = params;
  return useQuery({
    queryKey: [
      "eligible-shops",
      productId,
      variantId ?? null,
      pincode ?? null,
      lat ?? null,
      lng ?? null,
    ],
    enabled: !!productId && enabled,
    queryFn: async () => {
      if (!productId) return [];
      const { data, error } = await supabase.rpc(
        "list_eligible_shops_for_product",
        rpcArgs("list_eligible_shops_for_product", {
          _product_id: productId,
          _variant_id: variantId ?? null,
          _pincode: pincode ?? null,
          _lat: lat ?? null,
          _lng: lng ?? null,
        }),
      );
      if (error) throw error;
      return (data ?? []) as EligibleShop[];
    },
  });
}

export function ShopPicker({
  shops,
  loading,
  selectedShopId,
  onSelect,
  compact = false,
  emptyMessage = "No shop currently delivers to your address.",
}: {
  shops: EligibleShop[];
  loading?: boolean;
  selectedShopId: string | null;
  onSelect: (shop: EligibleShop) => void;
  compact?: boolean;
  emptyMessage?: string;
}) {
  const { cheapestId, fastestId } = useMemo(() => {
    if (shops.length === 0) return { cheapestId: null, fastestId: null };
    const cheapest = shops.reduce((a, b) => (a.price <= b.price ? a : b));
    const fastest = shops.reduce((a, b) => (a.delivery_minutes <= b.delivery_minutes ? a : b));
    return { cheapestId: cheapest.shop_id, fastestId: fastest.shop_id };
  }, [shops]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-16 w-full rounded-xl" />
        <Skeleton className="h-16 w-full rounded-xl" />
      </div>
    );
  }

  if (shops.length === 0) {
    return <p className="text-meta text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2.5">
      {shops.map((s) => {
        const active = s.shop_id === selectedShopId;
        return (
          <div
            key={s.shop_id}
            className={`rounded-xl p-3 transition-colors ${
              active ? "bg-primary-soft ring-1 ring-primary" : "bg-secondary/60"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="truncate text-body font-semibold">{s.shop_name}</span>
                  {s.shop_id === cheapestId && shops.length > 1 && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-caption font-medium text-primary-ink">
                      <TrendingDown className="h-3 w-3" /> Lowest price
                    </span>
                  )}
                  {s.shop_id === fastestId && shops.length > 1 && s.shop_id !== cheapestId && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-tint-sky px-2 py-0.5 text-caption font-medium text-foreground">
                      <Zap className="h-3 w-3" /> Fastest
                    </span>
                  )}
                </div>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-caption text-muted-foreground">
                  {s.distance_km != null && (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" />
                      {s.distance_km} km
                    </span>
                  )}
                  <span className="inline-flex items-center gap-0.5">
                    <Clock className="h-3 w-3" />
                    {s.delivery_minutes} min
                  </span>
                  {!compact && s.shop_address && <span className="truncate">{s.shop_address}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-body font-semibold">{rupees(s.price)}</div>
                {s.mrp > s.price && (
                  <div className="text-caption text-muted-foreground line-through">
                    {rupees(s.mrp)}
                  </div>
                )}
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant={active ? "outline" : "default"}
                onClick={() => onSelect(s)}
                className="h-8 rounded-full px-4"
              >
                {active ? (
                  <>
                    <Check className="h-3 w-3 mr-1" />
                    Selected
                  </>
                ) : (
                  "Select shop"
                )}
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
