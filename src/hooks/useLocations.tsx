import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizePincode, normalizePlace } from "@/lib/pincode";

export interface LocationRow {
  id: string;
  state: string;
  city: string;
  pincode: string;
  is_active: boolean;
}

export function useLocations() {
  return useQuery({
    queryKey: ["locations", "active"],
    queryFn: async (): Promise<LocationRow[]> => {
      const { data, error } = await supabase
        .from("locations")
        .select("id, state, city, pincode, is_active")
        .eq("is_active", true)
        .order("state")
        .order("city")
        .order("pincode");
      if (error) throw error;
      // Defensive normalization so UI values always match what routing compares.
      return (data ?? []).map((r) => ({
        ...r,
        state: normalizePlace(r.state),
        city: normalizePlace(r.city),
        pincode: normalizePincode(r.pincode),
      }));
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

export function deriveLocationOptions(rows: LocationRow[]) {
  const states = Array.from(new Set(rows.map((r) => r.state))).sort();
  const citiesByState = new Map<string, string[]>();
  const pincodesByCity = new Map<string, string[]>();
  for (const r of rows) {
    const cs = citiesByState.get(r.state) ?? [];
    if (!cs.includes(r.city)) cs.push(r.city);
    citiesByState.set(r.state, cs);
    const key = `${r.state}|${r.city}`;
    const ps = pincodesByCity.get(key) ?? [];
    if (!ps.includes(r.pincode)) ps.push(r.pincode);
    pincodesByCity.set(key, ps);
  }
  for (const arr of citiesByState.values()) arr.sort();
  for (const arr of pincodesByCity.values()) arr.sort();
  return { states, citiesByState, pincodesByCity };
}
