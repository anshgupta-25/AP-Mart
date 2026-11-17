import { useEffect, useRef, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import {
  GOOGLE_MAPS_AUTH_FAILURE_EVENT,
  GOOGLE_MAPS_AUTH_FAILURE_MESSAGE,
  loadGoogleMaps,
} from "@/lib/googleMaps";

export type MapShop = {
  id: string;
  name: string;
  address: string;
  city: string | null;
  latitude: number | null;
  longitude: number | null;
  service_radius_km: number;
  is_open: boolean;
  owner_email: string | null;
};

const OPEN_COLOR = "#1e8a4c";
const CLOSED_COLOR = "#8b8f97";
const RADIUS_COLOR = "#1e7f4a";
const DEFAULT_RADIUS_KM = 8;
// India, used only as the initial viewport before shops are fitted.
const FALLBACK_CENTER = { lat: 20.5937, lng: 78.9629 };

type Overlay = google.maps.Marker | google.maps.Circle;

/** Builds info-window content with textContent so shop data is never parsed as HTML. */
function buildInfoContent(s: MapShop): HTMLElement {
  const root = document.createElement("div");
  root.style.minWidth = "180px";
  root.style.fontSize = "12px";
  root.style.lineHeight = "1.4";

  const line = (text: string, bold = false) => {
    const el = document.createElement("div");
    el.textContent = text;
    if (bold) {
      el.style.fontWeight = "700";
      el.style.fontSize = "14px";
      el.style.marginBottom = "2px";
    }
    root.appendChild(el);
  };

  line(s.name, true);
  line([s.address, s.city].filter(Boolean).join(", "));
  line(`Owner: ${s.owner_email || "Unassigned"}`);
  line(`Radius ${s.service_radius_km} km · ${s.is_open ? "Open now" : "Closed"}`);
  return root;
}

/**
 * Google Maps view of shop locations. Each shop gets a status-coloured marker,
 * a delivery-radius circle and an info window. Coordinates come from Supabase.
 */
export function ShopsGoogleMap({
  shops,
  className = "h-72 w-full",
}: {
  shops: MapShop[];
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const infoRef = useRef<google.maps.InfoWindow | null>(null);
  const overlaysRef = useRef<Overlay[]>([]);
  const fittedRef = useRef(false);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  // Google can report a bad key after the script has already loaded; surface it clearly.
  useEffect(() => {
    const onAuthFailure = () => {
      setError(GOOGLE_MAPS_AUTH_FAILURE_MESSAGE);
      setStatus("error");
    };
    if (window.__gmapsAuthFailed) onAuthFailure();
    window.addEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, onAuthFailure);
    return () => window.removeEventListener(GOOGLE_MAPS_AUTH_FAILURE_EVENT, onAuthFailure);
  }, []);

  // Create the map once.
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps([])
      .then((g) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        mapRef.current = new g.maps.Map(containerRef.current, {
          center: FALLBACK_CENTER,
          zoom: 5,
          mapTypeControl: true,
          mapTypeControlOptions: { position: g.maps.ControlPosition.TOP_LEFT },
          zoomControl: true,
          zoomControlOptions: { position: g.maps.ControlPosition.RIGHT_CENTER },
          fullscreenControl: true,
          streetViewControl: false,
          scaleControl: true,
          clickableIcons: false,
        });
        infoRef.current = new g.maps.InfoWindow();
        setStatus("ready");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : "Google Maps failed to load.");
        setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Redraw markers and radius circles whenever the shop list changes.
  useEffect(() => {
    const map = mapRef.current;
    const info = infoRef.current;
    const g = typeof window !== "undefined" ? window.google : undefined;
    if (status !== "ready" || !map || !info || !g?.maps) return;

    overlaysRef.current.forEach((o) => o.setMap(null));
    overlaysRef.current = [];
    info.close();

    const bounds = new g.maps.LatLngBounds();
    const placed: google.maps.LatLngLiteral[] = [];

    for (const s of shops) {
      if (s.latitude == null || s.longitude == null) continue;
      const position = { lat: Number(s.latitude), lng: Number(s.longitude) };
      const radiusM = (Number(s.service_radius_km) || DEFAULT_RADIUS_KM) * 1000;

      const circle = new g.maps.Circle({
        map,
        center: position,
        radius: radiusM,
        strokeColor: RADIUS_COLOR,
        strokeOpacity: 0.8,
        strokeWeight: 1,
        fillColor: RADIUS_COLOR,
        fillOpacity: 0.08,
        clickable: false,
      });

      const marker = new g.maps.Marker({
        map,
        position,
        title: s.name,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 8,
          fillColor: s.is_open ? OPEN_COLOR : CLOSED_COLOR,
          fillOpacity: 1,
          strokeColor: "#ffffff",
          strokeWeight: 2,
        },
      });
      marker.addListener("click", () => {
        info.setContent(buildInfoContent(s));
        info.open({ anchor: marker, map });
      });

      overlaysRef.current.push(circle, marker);
      placed.push(position);
      const circleBounds = circle.getBounds();
      if (circleBounds) bounds.union(circleBounds);
      else bounds.extend(position);
    }

    // Frame all shops once on first load so later realtime updates don't move the view.
    if (!fittedRef.current && placed.length > 0) {
      if (placed.length === 1) {
        map.setCenter(placed[0]);
        map.setZoom(13);
      } else {
        map.fitBounds(bounds, 48);
      }
      fittedRef.current = true;
    }
  }, [shops, status]);

  return (
    <div className={`relative overflow-hidden rounded-xl ${className}`}>
      <div ref={containerRef} className="absolute inset-0" />
      {status !== "ready" && (
        <div
          className="absolute inset-0 flex items-center justify-center bg-secondary p-4 text-center"
          role={status === "error" ? "alert" : "status"}
          aria-label={status === "error" ? "Map error" : "Loading map"}
        >
          {status === "loading" ? (
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          ) : (
            <div className="flex max-w-md flex-col items-center gap-2 text-sm text-destructive">
              <AlertTriangle className="h-5 w-5" />
              <p className="font-medium">Map unavailable</p>
              <p className="text-muted-foreground">{error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
