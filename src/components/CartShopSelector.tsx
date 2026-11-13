import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Store,
  MapPin,
  Clock,
  Star,
  Zap,
  TrendingDown,
  Check,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { rupees } from "@/lib/format";
import { toast } from "sonner";

type CartShop = {
  shop_id: string;
  shop_name: string;
  shop_address: string | null;
  latitude: number | null;
  longitude: number | null;
  pincode: string | null;
  distance_km: number | null;
  delivery_minutes: number;
  price: number;
  mrp: number;
  stock: number;
};

export function CartShopSelector({
  deliveryLat,
  deliveryLng,
}: { deliveryLat?: number | null; deliveryLng?: number | null } = {}) {
  const { user } = useAuth();
  const { currentShop, currentShopId, changeShop, items } = useCart();
  const { pincode, lat: ctxLat, lng: ctxLng } = useDeliveryContext();
  const [open, setOpen] = useState(false);
  const [autoAssigned, setAutoAssigned] = useState(false);

  const lat = deliveryLat ?? ctxLat ?? null;
  const lng = deliveryLng ?? ctxLng ?? null;

  const shopsQuery = useQuery({
    queryKey: ["eligible-shops-cart", user?.id, pincode, lat, lng, items.length],
    enabled: !!user && items.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("list_eligible_shops_for_cart", {
        _pincode: pincode ?? null,
        _lat: lat,
        _lng: lng,
      });
      if (error) throw error;
      return (data ?? []) as CartShop[];
    },
  });

  const shops = shopsQuery.data ?? [];
  const cheapestId = shops.length
    ? shops.reduce((a, b) => (a.price <= b.price ? a : b)).shop_id
    : null;
  const fastestId = shops.length
    ? shops.reduce((a, b) => (a.delivery_minutes <= b.delivery_minutes ? a : b)).shop_id
    : null;

  // Auto-assign: pick nearest (or fastest if no distance) eligible shop when
  // cart has no shop yet, OR when the current shop is no longer eligible.
  useEffect(() => {
    if (!user || items.length === 0 || shopsQuery.isLoading) return;
    if (shops.length === 0) return;
    const eligible = shops.some((s) => s.shop_id === currentShopId);
    if (currentShopId && eligible) return;
    const best = shops.slice().sort((a, b) => {
      const da = a.distance_km ?? Number.POSITIVE_INFINITY;
      const db = b.distance_km ?? Number.POSITIVE_INFINITY;
      if (da !== db) return da - db;
      if (a.delivery_minutes !== b.delivery_minutes) return a.delivery_minutes - b.delivery_minutes;
      return a.price - b.price;
    })[0];
    if (best && best.shop_id !== currentShopId) {
      setAutoAssigned(true);
      changeShop(best.shop_id).catch(() => {});
      if (currentShopId && !eligible) {
        toast.info(`Switched to ${best.shop_name} — previous shop no longer available`);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopsQuery.isLoading, shops.length, currentShopId]);

  const select = async (s: CartShop) => {
    setAutoAssigned(false);
    await changeShop(s.shop_id);
    setOpen(false);
    toast.success(`Now ordering from ${s.shop_name}`);
  };

  if (!user || items.length === 0) return null;

  const active = shops.find((s) => s.shop_id === currentShopId);
  const displayName = active?.shop_name ?? currentShop?.name ?? "Finding the best shop…";
  const displayAddress = active?.shop_address ?? currentShop?.address ?? null;
  const displayDistance = active?.distance_km;
  const displayEta = active?.delivery_minutes ?? 15;

  const noShops = !shopsQuery.isLoading && shops.length === 0;

  return (
    <>
      <div className="rounded-xl border border-border/70 bg-card p-3">
        <div className="flex items-start gap-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tint-mint text-primary-ink">
            <Store className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="eyebrow">Delivering from</span>
              {autoAssigned && currentShopId && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-caption font-medium text-primary-ink">
                  <Sparkles className="h-2.5 w-2.5" /> Auto selected
                </span>
              )}
            </div>
            {noShops ? (
              <div className="text-meta font-semibold text-destructive">
                Sorry, all shops selling these products are currently closed or out of stock.
              </div>
            ) : (
              <>
                <div className="truncate text-body font-semibold">{displayName}</div>
                <div className="mt-0.5 flex items-center gap-2 text-caption text-muted-foreground flex-wrap">
                  {displayAddress && (
                    <span className="inline-flex items-center gap-0.5 truncate">
                      <MapPin className="h-3 w-3" /> {displayAddress}
                    </span>
                  )}
                  {displayDistance != null && (
                    <span className="inline-flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" /> {displayDistance} km
                    </span>
                  )}
                  <span className="inline-flex items-center gap-0.5">
                    <Clock className="h-3 w-3" /> {displayEta} min
                  </span>
                </div>
              </>
            )}
          </div>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setOpen(true)}
            className="h-8 shrink-0 rounded-full px-3"
            disabled={shops.length === 0}
          >
            Change shop <ChevronRight className="h-3 w-3 ml-0.5" />
          </Button>
        </div>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Choose a shop</DialogTitle>
            <DialogDescription>
              Shops in your PIN code that stock every item in your cart.
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[60vh] space-y-3 overflow-y-auto">
            {shopsQuery.isLoading ? (
              <>
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
              </>
            ) : shops.length === 0 ? (
              <p className="py-8 text-center text-meta text-muted-foreground">
                No shops in your PIN code can fulfill this cart right now.
              </p>
            ) : (
              shops.map((s) => {
                const isActive = s.shop_id === currentShopId;
                return (
                  <div
                    key={s.shop_id}
                    className={`rounded-xl p-3 transition-colors ${isActive ? "bg-primary-soft ring-1 ring-primary" : "bg-secondary/60"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="truncate text-body font-semibold">{s.shop_name}</span>
                          {s.shop_id === cheapestId && shops.length > 1 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-primary-soft px-2 py-0.5 text-caption font-medium text-primary-ink">
                              <TrendingDown className="h-3 w-3" /> Lowest
                            </span>
                          )}
                          {s.shop_id === fastestId &&
                            shops.length > 1 &&
                            s.shop_id !== cheapestId && (
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
                        </div>
                        {s.shop_address && (
                          <div className="mt-1 text-caption text-muted-foreground truncate">
                            {s.shop_address}
                          </div>
                        )}
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
                        variant={isActive ? "outline" : "default"}
                        onClick={() => select(s)}
                        className="h-8 rounded-full px-4"
                        disabled={isActive}
                      >
                        {isActive ? (
                          <>
                            <Check className="h-3 w-3 mr-1" />
                            Selected
                          </>
                        ) : (
                          "Select"
                        )}
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
