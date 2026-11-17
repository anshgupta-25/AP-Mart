// Async loader for the Google Maps JavaScript API.
// Browser key: VITE_GOOGLE_MAPS_API_KEY, falling back to the legacy
// VITE_GOOGLE_MAPS_BROWSER_KEY. Restrict the key by HTTP referrer in Google Cloud.
// Safe to call multiple times — resolves once.

declare global {
  interface Window {
    google?: typeof google;
    __gmapsResolve?: () => void;
    __gmapsPromise?: Promise<typeof google>;
    __gmapsInit?: () => void;
    gm_authFailure?: () => void;
    __gmapsAuthFailed?: boolean;
  }
}

const BROWSER_KEY =
  (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined) ||
  (import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY as string | undefined);
const CHANNEL = import.meta.env.VITE_GOOGLE_MAPS_TRACKING_ID as string | undefined;

export const GOOGLE_MAPS_MISSING_KEY_MESSAGE =
  "Google Maps API key is missing. Set VITE_GOOGLE_MAPS_API_KEY in .env and restart the dev server.";
export const GOOGLE_MAPS_AUTH_FAILURE_EVENT = "gmaps-auth-failure";
export const GOOGLE_MAPS_AUTH_FAILURE_MESSAGE =
  "Google Maps rejected the API key. Check that the key is valid, the Maps JavaScript API is enabled, billing is active, and this site's domain is allowed by the key's HTTP referrer restriction.";

export function loadGoogleMaps(
  libraries: ReadonlyArray<"places" | "geometry" | "marker" | "routes"> = ["places", "geometry"],
): Promise<typeof google> {
  if (typeof window === "undefined")
    return Promise.reject(new Error("loadGoogleMaps must be called in the browser"));
  if (window.google?.maps) return Promise.resolve(window.google);
  if (window.__gmapsPromise) return window.__gmapsPromise;
  if (!BROWSER_KEY) return Promise.reject(new Error(GOOGLE_MAPS_MISSING_KEY_MESSAGE));

  window.__gmapsPromise = new Promise<typeof google>((resolve, reject) => {
    // Google calls this when the key is invalid, unauthorized for the referrer, or billing is off.
    window.gm_authFailure = () => {
      // May fire after the init callback already resolved, so also flag it and notify listeners.
      window.__gmapsAuthFailed = true;
      window.dispatchEvent(new Event(GOOGLE_MAPS_AUTH_FAILURE_EVENT));
      reject(new Error(GOOGLE_MAPS_AUTH_FAILURE_MESSAGE));
    };
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
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
