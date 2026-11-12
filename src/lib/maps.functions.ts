// Server functions for Google Maps Platform calls that must use the
// server-side key (Routes / Distance Matrix / Geocoding). Browser-safe
// surfaces (Maps JS, Places Autocomplete) use the VITE_ browser key.
import { createServerFn } from "@tanstack/react-start";

const GATEWAY = "https://connector-gateway.lovable.dev/google_maps";

type LatLng = { lat: number; lng: number };

async function gatewayFetch(path: string, init: RequestInit = {}) {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY;
  const lovableKey = process.env.LOVABLE_API_KEY;
  if (!apiKey || !lovableKey) throw new Error("Google Maps gateway credentials missing");
  const res = await fetch(`${GATEWAY}${path}`, {
    ...init,
    headers: {
      "Authorization": `Bearer ${lovableKey}`,
      "X-Connection-Api-Key": apiKey,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Google Maps gateway ${res.status}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

function validLatLng(p: unknown): p is LatLng {
  if (!p || typeof p !== "object") return false;
  const { lat, lng } = p as { lat?: unknown; lng?: unknown };
  return typeof lat === "number" && typeof lng === "number"
    && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

/**
 * Compute traffic-aware route between two points using the Routes API.
 * Returns ETA seconds + distance meters + encoded polyline for rendering.
 */
export const computeRoute = createServerFn({ method: "POST" })
  .inputValidator((input: { origin: LatLng; destination: LatLng }) => {
    if (!validLatLng(input?.origin) || !validLatLng(input?.destination)) {
      throw new Error("Invalid origin or destination coordinates");
    }
    return input;
  })
  .handler(async ({ data }) => {
    const body = {
      origin: { location: { latLng: { latitude: data.origin.lat, longitude: data.origin.lng } } },
      destination: { location: { latLng: { latitude: data.destination.lat, longitude: data.destination.lng } } },
      travelMode: "TWO_WHEELER",
      routingPreference: "TRAFFIC_AWARE",
      polylineEncoding: "ENCODED_POLYLINE",
    };
    const json = await gatewayFetch("/routes/directions/v2:computeRoutes", {
      method: "POST",
      headers: { "X-Goog-FieldMask": "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline" },
      body: JSON.stringify(body),
    });
    const route = json?.routes?.[0];
    if (!route) return { etaSeconds: null, distanceMeters: null, polyline: null };
    const durationStr: string = route.duration ?? "0s";
    const etaSeconds = Number(durationStr.replace(/s$/, "")) || 0;
    return {
      etaSeconds,
      distanceMeters: Number(route.distanceMeters ?? 0),
      polyline: route.polyline?.encodedPolyline ?? null,
    };
  });

/**
 * Rank shops by driving distance/time from a delivery point.
 * Returns shop IDs ordered by ETA ascending.
 */
export const rankShopsByEta = createServerFn({ method: "POST" })
  .inputValidator((input: { destination: LatLng; shops: { id: string; lat: number; lng: number }[] }) => {
    if (!validLatLng(input?.destination)) throw new Error("Invalid destination");
    if (!Array.isArray(input?.shops) || input.shops.length === 0) throw new Error("No shops provided");
    if (input.shops.length > 25) throw new Error("Too many shops (max 25)");
    return input;
  })
  .handler(async ({ data }) => {
    const body = {
      origins: data.shops.map((s) => ({
        waypoint: { location: { latLng: { latitude: s.lat, longitude: s.lng } } },
        routeModifiers: {},
      })),
      destinations: [{
        waypoint: { location: { latLng: { latitude: data.destination.lat, longitude: data.destination.lng } } },
      }],
      travelMode: "TWO_WHEELER",
      routingPreference: "TRAFFIC_AWARE",
    };
    const json = await gatewayFetch("/routes/distanceMatrix/v2:computeRouteMatrix", {
      method: "POST",
      headers: { "X-Goog-FieldMask": "originIndex,destinationIndex,duration,distanceMeters,condition" },
      body: JSON.stringify(body),
    });
    const rows = Array.isArray(json) ? json : [];
    const ranked = rows
      .filter((r: any) => r?.condition === "ROUTE_EXISTS")
      .map((r: any) => ({
        shopId: data.shops[r.originIndex].id,
        etaSeconds: Number(String(r.duration ?? "0s").replace(/s$/, "")) || 0,
        distanceMeters: Number(r.distanceMeters ?? 0),
      }))
      .sort((a, b) => a.etaSeconds - b.etaSeconds);
    return { ranked };
  });

/**
 * Reverse geocode a coordinate into a readable address + PIN code.
 * Uses the server-side key through the connector gateway.
 */
export const reverseGeocode = createServerFn({ method: "POST" })
  .inputValidator((input: { lat: number; lng: number }) => {
    if (!validLatLng(input)) throw new Error("Invalid coordinates");
    return input;
  })
  .handler(async ({ data }) => {
    const json = await gatewayFetch(
      `/maps/api/geocode/json?latlng=${data.lat},${data.lng}&result_type=street_address|premise|sublocality|locality|postal_code`,
    );
    const result = json?.results?.[0];
    if (!result) return { formatted: null, pincode: null, city: null, state: null, area: null };
    const comps: Array<{ long_name: string; short_name: string; types: string[] }> = result.address_components ?? [];
    const pick = (type: string) => comps.find((c) => c.types.includes(type))?.long_name ?? null;
    return {
      formatted: (result.formatted_address as string) ?? null,
      pincode: pick("postal_code"),
      city: pick("locality") ?? pick("administrative_area_level_3") ?? pick("administrative_area_level_2"),
      state: pick("administrative_area_level_1"),
      area: pick("sublocality_level_1") ?? pick("sublocality") ?? pick("route") ?? pick("neighborhood"),
    };
  });
