import { useEffect, useMemo, useState, type ReactNode } from "react";
import "leaflet/dist/leaflet.css";

/**
 * Client-only wrapper for react-leaflet. Leaflet touches `window` at import
 * time, so we lazy-load it after mount to keep SSR happy.
 *
 * Mobile perf: uses Canvas renderer (one <canvas> instead of one SVG/DOM node
 * per marker/poly), disables fadeAnimation, and lowers zoomAnimationThreshold.
 */
export function LeafletMap({
  children,
  center,
  zoom = 14,
  className = "h-72 w-full rounded-2xl overflow-hidden border border-border",
  scrollWheelZoom = true,
}: {
  children: ReactNode | ((L: typeof import("react-leaflet")) => ReactNode);
  center: [number, number];
  zoom?: number;
  className?: string;
  scrollWheelZoom?: boolean;
}) {
  const [mods, setMods] = useState<typeof import("react-leaflet") | null>(null);
  const [leaflet, setLeaflet] = useState<typeof import("leaflet") | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [RL, L] = await Promise.all([
        import("react-leaflet"),
        import("leaflet"),
      ]);
      const iconUrl = (await import("leaflet/dist/images/marker-icon.png")).default;
      const iconRetinaUrl = (await import("leaflet/dist/images/marker-icon-2x.png")).default;
      const shadowUrl = (await import("leaflet/dist/images/marker-shadow.png")).default;
      L.Icon.Default.mergeOptions({ iconUrl, iconRetinaUrl, shadowUrl });
      if (mounted) { setLeaflet(L); setMods(RL); }
    })();
    return () => { mounted = false; };
  }, []);

  // Stable canvas renderer instance — reused across re-renders so children
  // don't trigger fresh renderer allocation.
  const renderer = useMemo(() => (leaflet ? leaflet.canvas({ padding: 0.5 }) : undefined), [leaflet]);

  if (!mods) {
    return <div className={`${className} bg-secondary animate-pulse`} aria-label="Loading map" />;
  }
  const { MapContainer, TileLayer } = mods;
  return (
    <div className={className}>
      <MapContainer
        center={center}
        zoom={zoom}
        scrollWheelZoom={scrollWheelZoom}
        style={{ height: "100%", width: "100%" }}
        preferCanvas
        renderer={renderer}
        fadeAnimation={false}
        zoomAnimationThreshold={2}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          updateWhenIdle
          keepBuffer={2}
        />
        {typeof children === "function" ? children(mods) : children}
      </MapContainer>
    </div>
  );
}

/** Haversine distance (km) — mirrors the SQL function. */
export function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
