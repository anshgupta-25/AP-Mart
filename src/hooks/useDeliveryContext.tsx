import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export type DeliveryContext = {
  pincode: string | null;
  lat: number | null;
  lng: number | null;
  addressLabel: string | null;
  /** true once we know whether the customer has a saved delivery address */
  hasAddress: boolean;
  addressId: string | null;
};

/**
 * Delivery context for the current customer. The saved default address is the
 * source of truth (pincode + pinned lat/lng); browser geolocation is only a
 * fallback used for distance ranking when an address has no coordinates.
 */
export function useDeliveryContext(): DeliveryContext & {
  ready: boolean;
  refresh: () => void;
} {
  const { user } = useAuth();
  const qc = useQueryClient();
  // Browser geolocation lives in the Query cache (single shared request per
  // session) — a per-component effect used to re-prompt and produce different
  // lat/lng per consumer, which changed query keys and refetched the catalog.
  const geo = useQuery({
    queryKey: ["browser-geo"],
    staleTime: Infinity,
    gcTime: Infinity,
    retry: 0,
    refetchOnMount: false,
    queryFn: () =>
      new Promise<{ lat: number; lng: number } | null>((resolve) => {
        if (typeof navigator === "undefined" || !navigator.geolocation) return resolve(null);
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: false, timeout: 4000, maximumAge: 300_000 },
        );
      }),
  });
  const coords = geo.data ?? null;

  const addr = useQuery({
    queryKey: ["default-address", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("addresses")
        .select("*")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data ?? null;
    },
  });

  const profile = useQuery({
    queryKey: ["profile-location", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("profiles")
        .select("state, city, pincode")
        .eq("id", user!.id)
        .maybeSingle();
      return data ?? null;
    },
  });

  const pincode =
    (addr.data?.pincode as string | undefined) ??
    (profile.data?.pincode as string | undefined) ??
    null;

  const addrLat = (addr.data as any)?.lat as number | null | undefined;
  const addrLng = (addr.data as any)?.lng as number | null | undefined;

  const addressLabel = addr.data
    ? `${addr.data.line1}, ${addr.data.city}`
    : profile.data?.city && profile.data?.state
      ? `${profile.data.city}, ${profile.data.state}`
      : null;

  /** Re-fetch everything that depends on the delivery address. */
  const refresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ["default-address"] });
    qc.invalidateQueries({ queryKey: ["customer-products"] });
    qc.invalidateQueries({ queryKey: ["cat-product-counts"] });
    qc.invalidateQueries({ queryKey: ["eligible-shops"] });
    qc.invalidateQueries({ queryKey: ["delivery-options"] });
    qc.invalidateQueries({ queryKey: ["app-addresses"] });
    qc.invalidateQueries({ queryKey: ["addresses"] });
  }, [qc]);

  return {
    pincode,
    lat: addrLat ?? coords?.lat ?? null,
    lng: addrLng ?? coords?.lng ?? null,
    addressLabel,
    hasAddress: !!addr.data,
    addressId: (addr.data?.id as string | undefined) ?? null,
    // Browser geolocation is only a distance-ranking fallback and is not part of any catalog
    // query key. Waiting for it blocked every product grid behind the permission prompt.
    ready: !user || (addr.isFetched && profile.isFetched),
    refresh,
  };
}

/**
 * How many shops can currently deliver to the customer's saved location.
 * Used to show an accurate "no shops deliver here" message.
 */
export function useEligibleShopCount() {
  const { pincode, lat, lng, ready } = useDeliveryContext();
  // Round coordinates in the key so tiny GPS jitter can't cause refetch storms.
  const latKey = lat == null ? null : Math.round(lat * 1000) / 1000;
  const lngKey = lng == null ? null : Math.round(lng * 1000) / 1000;
  return useQuery({
    queryKey: ["eligible-shops", pincode, latKey, lngKey],
    enabled: ready && (!!pincode || (lat != null && lng != null)),
    staleTime: 2 * 60_000,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("count_eligible_shops", {
        _pincode: pincode,
        _lat: lat,
        _lng: lng,
      });
      if (error) throw error;
      return Number(data ?? 0);
    },
  });
}
