import { useEffect, useRef, useState } from "react";
import { loadGoogleMaps, onGoogleMapsAuthFailure } from "@/lib/googleMaps";

export type ShopMapPoint = {
  id: string;
  name: string;
  address?: string | null;
  city?: string | null;
  latitude: number;
  longitude: number;
  service_radius_km?: number | null;
  is_open: boolean;
  owner_email?: string | null;
  owner_phone?: string | null;
};

const BRAND = "#168047"; // AP Mart green (Google Maps can't read CSS variables)
const DEFAULT_RADIUS_KM = 8;
const FALLBACK_CENTER = { lat: 28.6139, lng: 77.209 };

/** A line of text built with textContent, so shop data can never inject markup. */
function line(text: string, style: string) {
  const el = document.createElement("div");
  el.style.cssText = style;
  el.textContent = text;
  return el;
}

function infoContent(s: ShopMapPoint, detailed: boolean) {
  const root = document.createElement("div");
  root.style.cssText =
    "max-width:240px;overflow-wrap:anywhere;font:13px/1.4 system-ui,sans-serif;color:#111827";
  root.appendChild(line(s.name, "font-weight:700;font-size:14px;margin-bottom:2px"));
  const addr = [s.address, s.city].filter(Boolean).join(", ");
  if (addr) root.appendChild(line(addr, "color:#4b5563"));
  if (detailed) {
    root.appendChild(line(`Owner: ${s.owner_email || "Unassigned"}`, "color:#4b5563"));
    if (s.owner_phone) root.appendChild(line(`Phone: ${s.owner_phone}`, "color:#4b5563"));
  }
  root.appendChild(
    line(
      `Radius ${Number(s.service_radius_km) || DEFAULT_RADIUS_KM} km · ${s.is_open ? "Open" : "Closed"}`,
      `margin-top:4px;font-weight:600;color:${s.is_open ? BRAND : "#6b7280"}`,
    ),
  );
  return root;
}

/**
 * Google Maps view of shops: a marker per shop, a service-radius circle, an info window on
 * click, and a viewport that fits every shop. Client-only (the Maps script loads on mount).
 */
export function ShopsMap({
  shops,
  className = "h-72 w-full overflow-hidden rounded-xl",
  detailed = false,
}: {
  shops: ShopMapPoint[];
  className?: string;
  /** Adds owner email and phone to the info window (used in the full-screen map). */
  detailed?: boolean;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const mapRef = useRef<google.maps.Map | null>(null);
  const overlays = useRef<(google.maps.Marker | google.maps.Circle)[]>([]);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    const stopAuthWatch = onGoogleMapsAuthFailure(() => !cancelled && setError("auth"));
    loadGoogleMaps(["geometry"])
      .then((g) => {
        if (cancelled || !ref.current) return;
        mapRef.current = new g.maps.Map(ref.current, {
          center: FALLBACK_CENTER,
          zoom: 10,
          disableDefaultUI: true,
          zoomControl: true,
          clickableIcons: false,
          gestureHandling: "cooperative",
        });
        infoRef.current = new g.maps.InfoWindow();
        setReady(true);
      })
      .catch((e: Error) => !cancelled && setError(e.message));
    return () => {
      cancelled = true;
      stopAuthWatch();
      overlays.current.forEach((o) => o.setMap(null));
      overlays.current = [];
      infoRef.current?.close();
      infoRef.current = null;
      mapRef.current = null;
    };
  }, []);

  // Draw shops and fit the viewport whenever the shops change.
  useEffect(() => {
    const map = mapRef.current;
    const g = window.google;
    if (!ready || !map || !g?.maps) return;
    overlays.current.forEach((o) => o.setMap(null));
    overlays.current = [];
    infoRef.current?.close();

    const bounds = new g.maps.LatLngBounds();
    for (const s of shops) {
      const pos = { lat: s.latitude, lng: s.longitude };
      const marker = new g.maps.Marker({ map, position: pos, title: s.name });
      marker.addListener("click", () => {
        infoRef.current?.setContent(infoContent(s, detailed));
        infoRef.current?.open({ map, anchor: marker });
      });
      const circle = new g.maps.Circle({
        map,
        center: pos,
        radius: (Number(s.service_radius_km) || DEFAULT_RADIUS_KM) * 1000,
        strokeColor: BRAND,
        strokeOpacity: 0.7,
        strokeWeight: 1,
        fillColor: BRAND,
        fillOpacity: 0.06,
        clickable: false,
      });
      overlays.current.push(marker, circle);
      // Fit the whole service area, not just the pin, so the coverage circle is visible.
      const cb = circle.getBounds();
      if (cb) bounds.union(cb);
      else bounds.extend(pos);
    }
    if (shops.length === 0) {
      map.setCenter(FALLBACK_CENTER);
      map.setZoom(10);
    } else {
      map.fitBounds(bounds, 40);
    }
  }, [ready, shops, detailed]);

  if (error) {
    return (
      <div
        className={`${className} grid place-items-center bg-secondary px-4 text-center text-meta text-muted-foreground`}
        role="alert"
      >
        {error === "auth"
          ? "Google Maps rejected the API key. Check that the key is valid, the Maps JavaScript API is enabled, billing is on, and this site is allowed in the key's HTTP referrers."
          : "The map couldn't load. Check the Google Maps key and your connection."}
      </div>
    );
  }
  return (
    <div className={`${className} relative bg-secondary`}>
      {!ready && (
        <div className="absolute inset-0 animate-pulse bg-secondary" aria-label="Loading map" />
      )}
      <div ref={ref} className="h-full w-full" />
    </div>
  );
}
