// Async loader for the Google Maps JavaScript API.
// Uses the Lovable Google Maps Platform connector browser key (referrer-restricted).
// Safe to call multiple times — resolves once.

declare global {
  interface Window {
    google?: typeof google;
    __gmapsResolve?: () => void;
    __gmapsPromise?: Promise<typeof google>;
    __gmapsInit?: () => void;
  }
}

const BROWSER_KEY = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_BROWSER_KEY as string | undefined;
const CHANNEL = import.meta.env.VITE_LOVABLE_CONNECTOR_GOOGLE_MAPS_TRACKING_ID as string | undefined;

export function loadGoogleMaps(libraries: ReadonlyArray<"places" | "geometry" | "marker" | "routes"> = ["places", "geometry"]): Promise<typeof google> {
  if (typeof window === "undefined") return Promise.reject(new Error("loadGoogleMaps must be called in the browser"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (window.__gmapsPromise) return window.__gmapsPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error("Google Maps browser key missing. Reconnect the Google Maps Platform connector."));

  window.__gmapsPromise = new Promise<typeof google>((resolve, reject) => {
    window.__gmapsInit = () => {
      if (window.google?.maps) resolve(window.google);
      else reject(new Error("Google Maps failed to initialize"));
    };
    const s = document.createElement("script");
    const libs = libraries.join(",");
    const params = new URLSearchParams({
      key: BROWSER_KEY,
      loading: "async",
      callback: "__gmapsInit",
      libraries: libs,
      v: "weekly",
    });
    if (CHANNEL) params.set("channel", CHANNEL);
    s.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    s.async = true;
    s.defer = true;
    s.onerror = () => reject(new Error("Failed to load Google Maps script"));
    document.head.appendChild(s);
  });
  return window.__gmapsPromise;
}

/** Haversine distance (km) — kept as fallback when no live route. Mirrors SQL. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
