import { useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { loadGoogleMaps, haversineKm } from "@/lib/googleMaps";
import { computeRoute } from "@/lib/maps.functions";

export type MapPoint = { lat: number; lng: number; label?: string; color?: string };

/**
 * Google Maps route view. Renders pins for every point and a traffic-aware
 * Directions polyline between the first and last points (typically
 * rider → drop). When 3 points are present (rider → shop → customer), draws
 * two legs. Auto-fits bounds when route shape changes.
 *
 * Live ETA: when `showEta` is true and at least 2 points are provided,
 * fetches a server-side Distance Matrix ETA every 30s.
 */
export function RouteMap({
  points,
  height = "h-72",
  className,
  showEta = true,
}: {
  points: MapPoint[];
  height?: string;
  className?: string;
  showEta?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const polylineRef = useRef<google.maps.Polyline | null>(null);
  const [ready, setReady] = useState(false);

  const valid = useMemo(
    () => points.filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lng)),
    [points],
  );

  const sig = useMemo(
    () => valid.map((p) => `${p.label ?? ""}:${p.lat.toFixed(4)},${p.lng.toFixed(4)}`).join("|"),
    [valid],
  );

  // Haversine fallback distance
  const distanceKm = useMemo(() => {
    let d = 0;
    for (let i = 1; i < valid.length; i++) {
      d += haversineKm(valid[i - 1].lat, valid[i - 1].lng, valid[i].lat, valid[i].lng);
    }
    return d;
  }, [valid]);

  // Init map once
  useEffect(() => {
    let cancelled = false;
    if (!containerRef.current) return;
    loadGoogleMaps(["geometry"]).then((g) => {
      if (cancelled || !containerRef.current) return;
      mapRef.current = new g.maps.Map(containerRef.current, {
        center: valid[0] ?? { lat: 12.9716, lng: 77.5946 },
        zoom: 13,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: "greedy",
      });
      setReady(true);
    });
    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => m.setMap(null));
      markersRef.current = [];
      polylineRef.current?.setMap(null);
      polylineRef.current = null;
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live route polyline (origin → destination) via Routes API.
  // Uses first and last points; for rider→shop→customer this is rider→customer.
  const routeFn = useServerFn(computeRoute);
  const routeQ = useQuery({
    queryKey: ["live-route", sig],
    queryFn: async () => {
      if (valid.length < 2) return null;
      const origin = valid[0]; const destination = valid[valid.length - 1];
      try {
        return await routeFn({ data: { origin, destination } });
      } catch {
        return null;
      }
    },
    enabled: ready && valid.length >= 2,
    staleTime: 25_000,
    refetchInterval: showEta ? 30_000 : false,
  });

  // Sync markers + polyline whenever valid points or polyline data change
  useEffect(() => {
    const g = window.google;
    const map = mapRef.current;
    if (!ready || !g || !map) return;

    // Markers — recreate (cheap for ≤3 points)
    markersRef.current.forEach((m) => m.setMap(null));
    markersRef.current = valid.map((p, i) => {
      const isFirst = i === 0;
      const isLast = i === valid.length - 1;
      const color = p.color ?? (isFirst ? "#22c55e" : isLast ? "#ef4444" : "#f59e0b");
      const marker = new g.maps.Marker({
        position: { lat: p.lat, lng: p.lng },
        map,
        title: p.label,
        label: isFirst ? "A" : isLast ? "B" : undefined,
        icon: {
          path: g.maps.SymbolPath.CIRCLE,
          scale: 9,
          fillColor: color,
          fillOpacity: 1,
          strokeColor: "#fff",
          strokeWeight: 2,
        },
      });
      return marker;
    });

    // Polyline
    polylineRef.current?.setMap(null);
    if (valid.length >= 2) {
      let path: google.maps.LatLngLiteral[];
      if (routeQ.data?.polyline && g.maps.geometry?.encoding) {
        path = g.maps.geometry.encoding.decodePath(routeQ.data.polyline).map((l) => ({ lat: l.lat(), lng: l.lng() }));
      } else {
        path = valid.map((p) => ({ lat: p.lat, lng: p.lng }));
      }
      polylineRef.current = new g.maps.Polyline({
        path,
        map,
        strokeColor: "#16a34a",
        strokeOpacity: 0.9,
        strokeWeight: 5,
      });
    }

    // Fit bounds
    const bounds = new g.maps.LatLngBounds();
    valid.forEach((p) => bounds.extend({ lat: p.lat, lng: p.lng }));
    if (polylineRef.current) polylineRef.current.getPath().forEach((l) => bounds.extend(l));
    if (!bounds.isEmpty()) map.fitBounds(bounds, 40);
  }, [ready, sig, routeQ.data?.polyline, valid]);

  if (valid.length === 0) {
    return (
      <div className={`${height} w-full rounded-2xl border border-dashed border-border grid place-items-center text-sm text-muted-foreground ${className ?? ""}`}>
        No coordinates available
      </div>
    );
  }

  const etaMin = routeQ.data?.etaSeconds != null ? Math.max(1, Math.round(routeQ.data.etaSeconds / 60)) : null;
  const routeKm = routeQ.data?.distanceMeters != null ? routeQ.data.distanceMeters / 1000 : null;

  return (
    <div className={className}>
      <div ref={containerRef} className={`${height} w-full rounded-2xl overflow-hidden border border-border ${ready ? "" : "bg-secondary animate-pulse"}`} />
      {valid.length > 1 && (
        <div className="mt-2 text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
          <span>
            Distance: <span className="font-bold text-foreground">{(routeKm ?? distanceKm).toFixed(2)} km</span>
          </span>
          {showEta && etaMin != null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2 py-0.5 font-bold">
              ETA ~{etaMin} min
            </span>
          )}
        </div>
      )}
    </div>
  );
}
