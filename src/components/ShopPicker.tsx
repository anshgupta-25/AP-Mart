import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, MapPin, Clock, Zap, TrendingDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";

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
    queryKey: ["eligible-shops", productId, variantId ?? null, pincode ?? null, lat ?? null, lng ?? null],
    enabled: !!productId && enabled,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("list_eligible_shops_for_product", {
        _product_id: productId,
        _variant_id: variantId ?? null,
        _pincode: pincode ?? null,
        _lat: lat ?? null,
        _lng: lng ?? null,
      });
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
        <Skeleton className="h-20 w-full rounded-2xl" />
        <Skeleton className="h-20 w-full rounded-2xl" />
      </div>
    );
  }

  if (shops.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  return (
    <div className="space-y-2">
      {shops.map((s) => {
        const active = s.shop_id === selectedShopId;
        return (
          <div
            key={s.shop_id}
            className={`rounded-2xl border-2 p-3 transition ${
              active ? "border-primary bg-primary/5" : "border-border bg-card"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold text-sm truncate">{s.shop_name}</span>
                  {s.shop_id === cheapestId && shops.length > 1 && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase rounded-full bg-success/20 text-success-foreground px-1.5 py-0.5">
                      <TrendingDown className="h-3 w-3" /> Lowest price
                    </span>
                  )}
                  {s.shop_id === fastestId && shops.length > 1 && s.shop_id !== cheapestId && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase rounded-full bg-primary/15 text-primary px-1.5 py-0.5">
                      <Zap className="h-3 w-3" /> Fastest
                    </span>
                  )}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                  <span className="inline-flex items-center gap-0.5"><Star className="h-3 w-3 fill-current text-warning" />4.8</span>
                  {s.distance_km != null && (
                    <span className="inline-flex items-center gap-0.5"><MapPin className="h-3 w-3" />{s.distance_km} km</span>
                  )}
                  <span className="inline-flex items-center gap-0.5"><Clock className="h-3 w-3" />{s.delivery_minutes} min</span>
                  {!compact && s.shop_address && <span className="truncate">{s.shop_address}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <div className="font-bold text-sm text-primary">{rupees(s.price)}</div>
                {s.mrp > s.price && (
                  <div className="text-[11px] text-muted-foreground line-through">{rupees(s.mrp)}</div>
                )}
              </div>
            </div>
            <div className="mt-2 flex justify-end">
              <Button
                size="sm"
                variant={active ? "secondary" : "default"}
                onClick={() => onSelect(s)}
                className="rounded-lg h-8"
              >
                {active ? (
                  <><Check className="h-3 w-3 mr-1" />Selected</>
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
