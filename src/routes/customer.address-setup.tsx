import { createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { MapPin, Crosshair, PencilLine, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { isValidPincode, normalizePincode, normalizePlace } from "@/lib/pincode";
import { reverseGeocode } from "@/lib/maps.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/customer/address-setup")({
  head: () => ({
    meta: [
      { title: "Add your delivery address — AP Mart" },
      {
        name: "description",
        content: "Add your delivery location so AP Mart can show products available in your area.",
      },
    ],
  }),
  component: AddressSetupPage,
});

type Form = {
  name: string;
  phone: string;
  house_no: string;
  building: string;
  line1: string;
  landmark: string;
  city: string;
  state: string;
  pincode: string;
  type: "home" | "work" | "other";
};

const EMPTY: Form = {
  name: "",
  phone: "",
  house_no: "",
  building: "",
  line1: "",
  landmark: "",
  city: "",
  state: "",
  pincode: "",
  type: "home",
};

function AddressSetupPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasAddress, refresh } = useDeliveryContext();
  const search = useRouterState({ select: (s) => s.location.search as { next?: string } });

  const geocode = useServerFn(reverseGeocode);

  const [mode, setMode] = useState<"choose" | "form">("choose");
  const [form, setForm] = useState<Form>(EMPTY);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof Form, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const fillFromCoords = async (lat: number, lng: number) => {
    setCoords({ lat, lng });
    try {
      const g = await geocode({ data: { lat, lng } });
      setForm((f) => ({
        ...f,
        line1: f.line1 || g.area || g.formatted || "",
        city: g.city ?? f.city,
        state: g.state ?? f.state,
        pincode: g.pincode ?? f.pincode,
      }));
    } catch (e: any) {
      toast.error(e?.message ?? "Could not read that location — please fill the address manually");
    }
  };

  const useCurrentLocation = () => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      toast.error("Location is not available on this device");
      setMode("form");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await fillFromCoords(pos.coords.latitude, pos.coords.longitude);
        setLocating(false);
        setMode("form");
      },
      () => {
        setLocating(false);
        toast.error("Location permission denied — please add your address manually");
        setMode("form");
      },
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  const save = async () => {
    if (!user) return;
    const pin = normalizePincode(form.pincode);
    const cityV = normalizePlace(form.city);
    const stateV = normalizePlace(form.state);
    if (!form.name.trim() || !form.phone.trim())
      return toast.error("Please add your name and phone number");
    if (!form.house_no.trim()) return toast.error("Please add your house / flat number");
    if (!form.line1.trim()) return toast.error("Please add your street / area");
    if (!cityV || !stateV) return toast.error("Please add your city and state");
    if (!isValidPincode(pin)) return toast.error("Please enter a valid 6-digit PIN code");
    if (!coords) return toast.error("Please pin your exact location on the map");

    setSaving(true);
    const { error } = await supabase.from("addresses").insert({
      user_id: user.id,
      name: form.name.trim(),
      phone: form.phone.trim(),
      house_no: form.house_no.trim(),
      building: form.building.trim() || null,
      line1: [form.house_no.trim(), form.building.trim(), form.line1.trim()]
        .filter(Boolean)
        .join(", "),
      line2: form.building.trim() || null,
      landmark: form.landmark.trim() || null,
      city: cityV,
      state: stateV,
      pincode: pin,
      type: form.type,
      is_default: true,
      lat: coords.lat,
      lng: coords.lng,
    } as never);
    setSaving(false);
    if (error) return toast.error(error.message);

    // Keep the profile's service area in sync so fallbacks agree.
    await supabase
      .from("profiles")
      .update({ city: cityV, state: stateV, pincode: pin } as never)
      .eq("id", user.id);

    await qc.invalidateQueries();
    refresh();
    toast.success("Delivery address saved");
    navigate({ to: search?.next ?? "/customer/home", replace: true });
  };

  return (
    <div className="min-h-screen bg-background px-4 pb-safe pt-safe py-6">
      <div className="mx-auto w-full max-w-md">
        {mode === "choose" ? (
          <div className="pt-8 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-tint-mint text-primary-ink">
              <MapPin className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <h1 className="large-title mt-4">Where should we deliver?</h1>
            <p className="mt-1.5 text-meta text-muted-foreground">
              Add your address so we can show products from shops near you.
            </p>

            <div className="mt-6 space-y-2.5">
              <Button
                onClick={useCurrentLocation}
                disabled={locating}
                className="h-11 w-full rounded-xl"
              >
                {locating ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Crosshair className="mr-2 h-4 w-4" />
                )}
                Use current location
              </Button>
              <Button
                variant="secondary"
                onClick={() => setMode("form")}
                className="h-11 w-full rounded-xl"
              >
                <PencilLine className="mr-2 h-4 w-4" /> Enter address manually
              </Button>
            </div>

            {hasAddress && (
              <button
                onClick={() => navigate({ to: "/customer/home" })}
                className="press mt-5 text-meta font-medium text-primary"
              >
                Keep my current address
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-4 pb-8">
            <button
              onClick={() => setMode("choose")}
              className="press flex items-center gap-1 text-meta font-medium text-primary"
            >
              <ArrowLeft className="h-4 w-4" /> Back
            </button>
            <h1 className="large-title">Address details</h1>
            <p className="text-meta text-muted-foreground">
              Pin your exact location, then fill in the details below.
            </p>

            <LocationPicker
              value={coords}
              onChange={(v) => void fillFromCoords(v.lat, v.lng)}
              height="h-56"
            />

            <div className="grid grid-cols-2 gap-3">
              <Field label="Full name" value={form.name} onChange={(v) => set("name", v)} />
              <Field
                label="Phone"
                value={form.phone}
                onChange={(v) => set("phone", v)}
                inputMode="tel"
              />
              <Field
                label="House / Flat no."
                value={form.house_no}
                onChange={(v) => set("house_no", v)}
              />
              <Field
                label="Building / Society"
                value={form.building}
                onChange={(v) => set("building", v)}
              />
              <div className="col-span-2">
                <Field label="Street / Area" value={form.line1} onChange={(v) => set("line1", v)} />
              </div>
              <div className="col-span-2">
                <Field
                  label="Landmark (optional)"
                  value={form.landmark}
                  onChange={(v) => set("landmark", v)}
                />
              </div>
              <Field label="City" value={form.city} onChange={(v) => set("city", v)} />
              <Field label="State" value={form.state} onChange={(v) => set("state", v)} />
              <Field
                label="PIN code"
                value={form.pincode}
                onChange={(v) => set("pincode", v.replace(/\D/g, "").slice(0, 6))}
                inputMode="numeric"
              />
              <div>
                <Label className="text-small text-muted-foreground">Label</Label>
                <div className="mt-1.5 grid grid-cols-3 gap-1.5">
                  {(["home", "work", "other"] as const).map((t) => (
                    <button
                      key={t}
                      onClick={() => set("type", t)}
                      className={cn(
                        "press h-10 rounded-lg text-small font-medium capitalize transition-colors",
                        form.type === t
                          ? "bg-foreground text-background"
                          : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {t}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {coords && (
              <p className="text-caption text-muted-foreground">
                Pinned at {coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}
              </p>
            )}

            <Button onClick={save} disabled={saving} className="h-11 w-full rounded-xl">
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save address and continue
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  inputMode,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  inputMode?: "tel" | "numeric";
}) {
  return (
    <div>
      <Label className="text-small text-muted-foreground">{label}</Label>
      <Input
        value={value}
        inputMode={inputMode}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1.5"
      />
    </div>
  );
}
