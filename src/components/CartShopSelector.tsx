import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Store, MapPin, Clock, Star, Zap, TrendingDown, Check, ChevronRight, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCart } from "@/hooks/useCart";
import { useAuth } from "@/hooks/useAuth";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  const cheapestId = shops.length ? shops.reduce((a, b) => (a.price <= b.price ? a : b)).shop_id : null;
  const fastestId = shops.length ? shops.reduce((a, b) => (a.delivery_minutes <= b.delivery_minutes ? a : b)).shop_id : null;

  // Auto-assign: pick nearest (or fastest if no distance) eligible shop when
  // cart has no shop yet, OR when the current shop is no longer eligible.
  useEffect(() => {
    if (!user || items.length === 0 || shopsQuery.isLoading) return;
    if (shops.length === 0) return;
    const eligible = shops.some((s) => s.shop_id === currentShopId);
    if (currentShopId && eligible) return;
    const best =
      shops.slice().sort((a, b) => {
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
      <div className="mb-3 rounded-2xl border border-border bg-card p-3 shadow-card">
        <div className="flex items-start gap-3">
          <div className="h-11 w-11 rounded-xl bg-primary/10 grid place-items-center text-primary shrink-0">
            <Store className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                Delivering from
              </span>
              {autoAssigned && currentShopId && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-bold rounded-full bg-primary/15 text-primary px-1.5 py-0.5">
                  <Sparkles className="h-2.5 w-2.5" /> Auto selected
                </span>
              )}
            </div>
            {noShops ? (
              <div className="font-bold text-sm text-destructive">
                Sorry, all shops selling these products are currently closed or out of stock.
              </div>

            ) : (
              <>
                <div className="font-bold text-sm truncate">{displayName}</div>
                <div className="mt-0.5 flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                  {displayAddress && (
                    <span className="inline-flex items-center gap-0.5 truncate">
                      <MapPin className="h-3 w-3" /> {displayAddress}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-0.5">
                    <Star className="h-3 w-3 fill-current text-warning" /> 4.8
                  </span>
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
            variant="outline"
            size="sm"
            onClick={() => setOpen(true)}
            className="rounded-lg shrink-0"
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
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {shopsQuery.isLoading ? (
              <>
                <Skeleton className="h-24 rounded-2xl" />
                <Skeleton className="h-24 rounded-2xl" />
              </>
            ) : shops.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8 text-center">
                No shops in your PIN code can fulfill this cart right now.
              </p>
            ) : (
              shops.map((s) => {
                const isActive = s.shop_id === currentShopId;
                return (
                  <div
                    key={s.shop_id}
                    className={`rounded-2xl border-2 p-3 transition ${isActive ? "border-primary bg-primary/5" : "border-border bg-card"}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm truncate">{s.shop_name}</span>
                          {s.shop_id === cheapestId && shops.length > 1 && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase rounded-full bg-success/20 text-success-foreground px-1.5 py-0.5">
                              <TrendingDown className="h-3 w-3" /> Lowest
                            </span>
                          )}
                          {s.shop_id === fastestId && shops.length > 1 && s.shop_id !== cheapestId && (
                            <span className="inline-flex items-center gap-0.5 text-[10px] font-bold uppercase rounded-full bg-primary/15 text-primary px-1.5 py-0.5">
                              <Zap className="h-3 w-3" /> Fastest
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                          <span className="inline-flex items-center gap-0.5">
                            <Star className="h-3 w-3 fill-current text-warning" />4.8
                          </span>
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
                          <div className="mt-1 text-[11px] text-muted-foreground truncate">{s.shop_address}</div>
                        )}
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
                        variant={isActive ? "secondary" : "default"}
                        onClick={() => select(s)}
                        className="rounded-lg h-8"
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
