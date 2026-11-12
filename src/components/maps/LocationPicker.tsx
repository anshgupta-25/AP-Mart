import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MapPin, Crosshair, Search } from "lucide-react";
import { toast } from "sonner";
import { loadGoogleMaps } from "@/lib/googleMaps";

export type LatLng = { lat: number; lng: number };

/**
 * Google Maps-based location picker with Places Autocomplete (New).
 * - Type to search any address (uses Places API New PlaceAutocompleteElement)
 * - Tap "Use my location" for instant GPS pin
 * - Drag marker or tap map to fine-tune
 */
export function LocationPicker({
  value,
  onChange,
  className,
  height = "h-72",
}: {
  value: LatLng | null;
  onChange: (v: LatLng) => void;
  className?: string;
  height?: string;
}) {
  const mapDiv = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const mapRef = useRef<google.maps.Map | null>(null);
  const markerRef = useRef<google.maps.Marker | null>(null);
  const sessionTokenRef = useRef<google.maps.places.AutocompleteSessionToken | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [ready, setReady] = useState(false);
  const [query, setQuery] = useState("");
  const [suggestions, setSuggestions] = useState<{ placeId: string; text: string }[]>([]);
  const [showSug, setShowSug] = useState(false);

  // Init map
  useEffect(() => {
    let cancelled = false;
    loadGoogleMaps(["places", "geometry"]).then((g) => {
      if (cancelled || !mapDiv.current) return;
      const center = value ?? { lat: 12.9716, lng: 77.5946 };
      const map = new g.maps.Map(mapDiv.current, {
        center,
        zoom: value ? 16 : 13,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
      });
      mapRef.current = map;
      sessionTokenRef.current = new g.maps.places.AutocompleteSessionToken();
      if (value) placeMarker(value);
      map.addListener("click", (e: google.maps.MapMouseEvent) => {
        if (!e.latLng) return;
        const v = { lat: e.latLng.lat(), lng: e.latLng.lng() };
        placeMarker(v); onChange(v);
      });
      setReady(true);
    }).catch((err) => toast.error(err.message ?? "Could not load map"));
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync external value into marker
  useEffect(() => {
    if (!ready || !value) return;
    placeMarker(value);
    mapRef.current?.panTo(value);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, value?.lat, value?.lng]);

  const placeMarker = (v: LatLng) => {
    const g = window.google;
    if (!g || !mapRef.current) return;
    if (markerRef.current) {
      markerRef.current.setPosition(v);
    } else {
      markerRef.current = new g.maps.Marker({
        position: v,
        map: mapRef.current,
        draggable: true,
      });
      markerRef.current.addListener("dragend", () => {
        const p = markerRef.current!.getPosition();
        if (p) onChange({ lat: p.lat(), lng: p.lng() });
      });
    }
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) return toast.error("Geolocation not available");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const v = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        onChange(v); placeMarker(v);
        mapRef.current?.panTo(v); mapRef.current?.setZoom(17);
        toast.success("Location captured");
      },
      () => toast.error("Could not get location"),
    );
  };

  // Places Autocomplete (New API surface)
  const onQuery = (text: string) => {
    setQuery(text); setShowSug(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!text.trim()) { setSuggestions([]); return; }
    debounceRef.current = setTimeout(async () => {
      try {
        const g = window.google;
        if (!g) return;
        const { AutocompleteSuggestion } = await g.maps.importLibrary("places") as google.maps.PlacesLibrary;
        const { suggestions: sug } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
          input: text,
          sessionToken: sessionTokenRef.current ?? undefined,
        });
        setSuggestions(
          sug
            .map((s) => s.placePrediction)
            .filter((p): p is google.maps.places.PlacePrediction => !!p)
            .slice(0, 6)
            .map((p) => ({ placeId: p.placeId, text: p.text?.toString() ?? "" })),
        );
      } catch (e: any) {
        console.warn("places autocomplete:", e?.message ?? e);
      }
    }, 220);
  };

  const selectSuggestion = async (placeId: string, text: string) => {
    setQuery(text); setShowSug(false);
    try {
      const g = window.google;
      if (!g) return;
      const { Place } = await g.maps.importLibrary("places") as google.maps.PlacesLibrary;
      const place = new Place({ id: placeId });
      await place.fetchFields({ fields: ["location"] });
      const loc = place.location;
      if (!loc) return toast.error("No coordinates for that place");
      const v = { lat: loc.lat(), lng: loc.lng() };
      onChange(v); placeMarker(v);
      mapRef.current?.panTo(v); mapRef.current?.setZoom(17);
      // Reset session token after each picked place (billing best practice)
      sessionTokenRef.current = new g.maps.places.AutocompleteSessionToken();
    } catch (e: any) {
      toast.error(e?.message ?? "Could not load place");
    }
  };

  return (
    <div className={className}>
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            ref={inputRef}
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            onFocus={() => suggestions.length && setShowSug(true)}
            onBlur={() => setTimeout(() => setShowSug(false), 150)}
            placeholder="Search address, area, landmark…"
            className="pl-9 h-11 rounded-xl"
          />
        </div>
        {showSug && suggestions.length > 0 && (
          <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-popover shadow-lg overflow-hidden">
            {suggestions.map((s) => (
              <button
                key={s.placeId}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectSuggestion(s.placeId, s.text)}
                className="flex items-start gap-2 w-full text-left px-3 py-2 hover:bg-accent text-sm"
              >
                <MapPin className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <span className="line-clamp-2">{s.text}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-2 rounded-2xl overflow-hidden border border-border">
        <div ref={mapDiv} className={`${height} w-full ${ready ? "" : "bg-secondary animate-pulse"}`} />
      </div>

      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="text-xs text-muted-foreground inline-flex items-center gap-1">
          <MapPin className="h-3 w-3 text-primary" />
          {value ? `${value.lat.toFixed(5)}, ${value.lng.toFixed(5)}` : "Search, tap map, or use my location"}
        </div>
        <Button type="button" size="sm" variant="outline" className="rounded-xl" onClick={useMyLocation}>
          <Crosshair className="h-3.5 w-3.5 mr-1.5" /> Use my location
        </Button>
      </div>
    </div>
  );
}
