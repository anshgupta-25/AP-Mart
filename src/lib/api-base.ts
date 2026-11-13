// Where server functions live.
//
// On the website the app and its server share an origin, so relative URLs
// (`/_serverFn/...`) just work. In the Android app (Capacitor) the UI is
// served from local files at https://localhost, so server calls must go to
// the hosted server instead. Set VITE_API_BASE_URL (e.g. in .env.mobile) to
// that server's public HTTPS origin, e.g. https://api.apmart.in

const RAW_BASE = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim();

export const API_BASE_URL = RAW_BASE ? RAW_BASE.replace(/\/+$/, "") : undefined;

/** Rewrites a same-origin path to the hosted server when an API base is configured. */
export function toApiUrl(input: RequestInfo | URL): RequestInfo | URL {
  if (!API_BASE_URL) return input;
  if (typeof input === "string" && input.startsWith("/")) return API_BASE_URL + input;
  if (input instanceof URL && input.origin === globalThis.location?.origin) {
    return API_BASE_URL + input.pathname + input.search;
  }
  return input;
}

// Origins the Android/iOS app runs on. Requests from these may call the server.
// Android uses https://localhost (Capacitor default); capacitor://localhost is iOS.
const NATIVE_APP_ORIGINS = new Set(["https://localhost", "capacitor://localhost"]);

/** CORS headers for a request coming from the native app, or null for other origins. */
export function corsHeadersFor(origin: string | null): Record<string, string> | null {
  if (!origin || !NATIVE_APP_ORIGINS.has(origin)) return null;
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "Authorization, Content-Type, Accept, x-tsr-serverFn, x-tss-context",
    // The server-function client reads these to decode responses.
    "Access-Control-Expose-Headers": "x-tss-serialized, x-tss-raw, Content-Type",
    "Access-Control-Max-Age": "86400",
    Vary: "Origin",
  };
}

/**
 * Public website origin for links that open outside the app (email confirmation,
 * password reset). In the Android app window.location.origin is https://localhost,
 * which only exists on the phone, so use the hosted site instead.
 */
export function publicSiteOrigin(): string {
  const site = (import.meta.env.VITE_PUBLIC_SITE_URL as string | undefined)
    ?.trim()
    .replace(/\/+$/, "");
  return site || API_BASE_URL || window.location.origin;
}
