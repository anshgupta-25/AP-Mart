import { createFileRoute, useNavigate, Link, Navigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import confetti from "canvas-confetti";
import { MapPin, Plus, Wallet, CreditCard, Tag, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { rupees } from "@/lib/format";
import { toast } from "sonner";
import { openRazorpayCheckout } from "@/integrations/razorpay/checkout";
import { createRazorpayOrder, verifyRazorpayPayment, recordPaymentFailure } from "@/lib/razorpay.functions";
import { LocationPicker } from "@/components/maps/LocationPicker";
import { CartShopSelector } from "@/components/CartShopSelector";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
import { AuthRequired } from "@/components/AuthRequired";

export const Route = createFileRoute("/checkout")({
  head: () => ({ meta: [{ title: "Checkout — AP Mart" }] }),
  component: CheckoutPage,
});

function CheckoutPage() {
  const { user } = useAuth();
  const { items, subtotal, clear } = useCart();
  const navigate = useNavigate();
  const createRzpOrder = useServerFn(createRazorpayOrder);
  const verifyRzp = useServerFn(verifyRazorpayPayment);
  const recordFail = useServerFn(recordPaymentFailure);

  const addresses = useQuery({
    queryKey: ["addresses", user?.id],
    queryFn: async () =>
      user ? (await supabase.from("addresses").select("*").eq("user_id", user.id)).data ?? [] : [],
    enabled: !!user,
  });

  const [selectedAddr, setSelectedAddr] = useState<string | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [newAddr, setNewAddr] = useState({
    name: "", phone: "", line1: "", line2: "", landmark: "", city: "", state: "", pincode: "",
    type: "home" as "home" | "work" | "other",
  });
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const { refresh: refreshDelivery } = useDeliveryContext();
  const [coupon, setCoupon] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [applyingCoupon, setApplyingCoupon] = useState(false);
  const [instruction, setInstruction] = useState("");
  const [method, setMethod] = useState<"cod" | "razorpay">("cod");
  const [deliveryType, setDeliveryType] = useState<"fast_delivery" | "standard_delivery" | "express_delivery" | "pickup">("standard_delivery");
  const [placing, setPlacing] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const safeSetPlacing = (v: boolean) => { if (mounted.current) setPlacing(v); };

  const selectedAddrObj = addresses.data?.find((a) => a.id === selectedAddr) ?? null;
  const activePincode = (selectedAddrObj as any)?.pincode ?? null;

  const zone = useQuery({
    queryKey: ["delivery-zone", activePincode],
    enabled: !!activePincode,
    queryFn: async () => {
      const { data } = await (supabase as any).rpc("get_delivery_options_for_pincode", { _pincode: activePincode });
      const row = Array.isArray(data) ? data[0] : data;
      return row ?? null;
    },
  });

  const tiers = (() => {
    const z: any = zone.data;
    const arr: Array<{ id: "standard_delivery" | "fast_delivery" | "express_delivery" | "pickup"; icon: string; title: string; sub: string; fee: number; minOrder: number | null }> = [];
    if (!z) {
      arr.push({ id: "standard_delivery", icon: "🚚", title: "Standard Delivery", sub: "45–60 minutes", fee: 0, minOrder: null });
      arr.push({ id: "fast_delivery", icon: "⚡", title: "Fast Delivery", sub: "20–30 minutes", fee: 100, minOrder: null });
    } else {
      if (z.standard_enabled) arr.push({ id: "standard_delivery", icon: "🚚", title: "Standard Delivery", sub: `${z.standard_eta_minutes} minutes`, fee: Number(z.standard_fee) || 0, minOrder: z.minimum_order_standard != null ? Number(z.minimum_order_standard) : null });
      if (z.fast_enabled) arr.push({ id: "fast_delivery", icon: "⚡", title: "Fast Delivery", sub: `${z.fast_eta_minutes} minutes`, fee: Number(z.fast_fee) || 0, minOrder: z.minimum_order_fast != null ? Number(z.minimum_order_fast) : null });
      if (z.express_enabled) arr.push({ id: "express_delivery", icon: "🚀", title: "Express Delivery", sub: `${z.express_eta_minutes} minutes`, fee: Number(z.express_fee) || 0, minOrder: z.minimum_order_express != null ? Number(z.minimum_order_express) : null });
    }
    arr.push({ id: "pickup", icon: "🏪", title: "Store Pickup", sub: "Pick up from the shop yourself", fee: 0, minOrder: null });
    return arr;
  })();

  // Auto-switch away from a disabled tier when zone loads
  useEffect(() => {
    if (!tiers.some((t) => t.id === deliveryType)) {
      setDeliveryType(tiers[0]?.id ?? "standard_delivery");
    }
  }, [zone.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedTier = tiers.find((t) => t.id === deliveryType) ?? tiers[0];
  const deliveryFee = selectedTier?.fee ?? 0;
  const handling = (() => {
    const z: any = zone.data;
    if (!z || !z.handling_enabled) return 0;
    if (z.free_handling_above != null && subtotal >= Number(z.free_handling_above)) return 0;
    const tierOverride =
      deliveryType === "standard_delivery" ? z.standard_handling_fee
      : deliveryType === "fast_delivery" ? z.fast_handling_fee
      : deliveryType === "express_delivery" ? z.express_handling_fee
      : null;
    if (tierOverride != null && tierOverride !== "") return Math.max(0, Number(tierOverride));
    if (z.handling_type === "percent") {
      return Math.max(0, Math.round((subtotal * (Number(z.handling_percentage) || 0)) / 100 * 100) / 100);
    }
    return Math.max(0, Number(z.default_handling_fee) || 0);
  })();
  const discount = appliedCoupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount) + deliveryFee + handling;
  const minOrderNotMet = selectedTier?.minOrder != null && subtotal < selectedTier.minOrder;

  // Re-validate coupon when subtotal changes (cart updates)
  useEffect(() => {
    if (appliedCoupon && subtotal === 0) setAppliedCoupon(null);
  }, [subtotal, appliedCoupon]);

  const applyCoupon = async () => {
    const code = coupon.trim().toUpperCase();
    if (!code) return toast.error("Enter a coupon code");
    setApplyingCoupon(true);
    const { data, error } = await (supabase as any).rpc("validate_coupon", {
      _code: code,
      _subtotal: subtotal,
    });
    setApplyingCoupon(false);
    if (error) return toast.error(error.message || "Invalid coupon code");
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) return toast.error("Invalid coupon code");
    const disc = Number(row.discount) || 0;
    setAppliedCoupon({ code: row.code ?? code, discount: Math.round(disc * 100) / 100 });
    toast.success(`${code} applied — you saved ₹${disc.toFixed(0)}`);
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCoupon("");
  };

  // Switching the delivery address must refresh shops, products and ETAs.
  useEffect(() => {
    if (selectedAddr) refreshDelivery();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAddr]);

  useEffect(() => {
    if (!selectedAddr && (addresses.data?.length ?? 0) > 0) {
      const def = addresses.data!.find((a) => a.is_default) ?? addresses.data![0];
      setSelectedAddr(def.id);
    }
  }, [addresses.data, selectedAddr]);

  if (!user) {
    return (
      <AuthRequired
        next="/checkout"
        title="Almost There"
        description="Sign in to confirm your delivery address and place this order."
      />
    );
  }
  if (items.length === 0) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <p className="text-muted-foreground">Your cart is empty.</p>
        <Link to="/products" className="mt-4 inline-block text-primary font-bold">Shop now →</Link>
      </div>
    );
  }



  const saveNewAddress = async () => {
    if (!newAddr.line1 || !newAddr.city || !newAddr.pincode || !newAddr.phone || !newAddr.name) {
      toast.error("Please fill name, phone, line 1, city and pincode");
      return;
    }
    const { data, error } = await supabase
      .from("addresses")
      .insert({ ...newAddr, user_id: user.id, lat: coords?.lat ?? null, lng: coords?.lng ?? null } as never)
      .select()
      .single();
    if (error) return toast.error(error.message);
    setSelectedAddr(data.id);
    setShowNew(false);
    addresses.refetch();
    // Address changed → refresh eligible shops, products and delivery estimates.
    refreshDelivery();
    toast.success("Address saved");
  };


  const place = async () => {
    if (!selectedAddr || !addresses.data?.length) {
      toast.error("Please add a delivery address");
      setShowNew(true);
      return;
    }
    const addr = addresses.data.find((a) => a.id === selectedAddr);
    if (!addr) return toast.error("Please add a delivery address");

    const lat = coords?.lat ?? (addr as any).lat;
    const lng = coords?.lng ?? (addr as any).lng;
    if (lat == null || lng == null) {
      toast.error("Please pin your delivery location on the map to continue.");
      return;
    }
    const addressWithCoords: any = { ...addr, lat, lng };

    setPlacing(true);
    const { data, error } = await (supabase as any).rpc("place_multi_shop_order", {
      _address: addressWithCoords,
      _payment_method: method,
      _coupon_code: appliedCoupon?.code ?? undefined,
      _delivery_instruction: instruction || undefined,
      _lat: lat,
      _lng: lng,
      _pincode: addressWithCoords.pincode ?? null,
      _delivery_type: deliveryType,
    });

    if (error) {
      setPlacing(false);
      console.error("place_multi_shop_order error:", error);
      if (String(error.message || "").includes("no_coverage")) {
        return toast.error("No combination of shops in your area can supply every item in your cart. Please remove unavailable items or change address.");
      }
      return toast.error(error.message || "Could not place order");
    }
    const row = Array.isArray(data) ? data[0] : data;
    const orderId = row?.parent_order_id ?? row?.parent_order_id;
    if (!orderId) {
      setPlacing(false);
      return toast.error("Order created but no id returned");
    }

    if (method === "cod") {
      setPlacing(false);
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 } });
      toast.success("Order placed!");
      clear();
      navigate({ to: "/orders/$id", params: { id: orderId } });
      return;
    }

    // Razorpay flow
    try {
      const rzp = await createRzpOrder({ data: { orderId } });
      await openRazorpayCheckout({
        keyId: rzp.keyId,
        amount: rzp.amount,
        currency: rzp.currency,
        razorpayOrderId: rzp.razorpayOrderId,
        orderNumber: rzp.orderNumber,
        prefill: {
          name: (addr as any).name,
          contact: (addr as any).phone,
          email: user.email ?? undefined,
        },
        onSuccess: async (resp) => {
          try {
            await verifyRzp({
              data: {
                orderId,
                razorpayOrderId: resp.razorpay_order_id,
                razorpayPaymentId: resp.razorpay_payment_id,
                razorpaySignature: resp.razorpay_signature,
              },
            });
            confetti({ particleCount: 140, spread: 80, origin: { y: 0.6 } });
            toast.success("Payment successful");
            clear();
            navigate({ to: "/orders/$id", params: { id: orderId } });
          } catch (e: any) {
            toast.error(e.message ?? "Payment verification failed");
          } finally { safeSetPlacing(false); }
        },
        onFailure: async (err) => {
          await recordFail({
            data: { razorpayOrderId: rzp.razorpayOrderId, code: err.code, description: err.description },
          }).catch(() => {});
          toast.error(err.description ?? "Payment failed");
          safeSetPlacing(false);
        },
        onDismiss: () => {
          toast.info("Payment cancelled. You can pay from your orders page.");
          safeSetPlacing(false);
          navigate({ to: "/orders/$id", params: { id: orderId } });
        },
      });
    } catch (e: any) {
      setPlacing(false);
      toast.error(e.message ?? "Could not start payment");
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 grid md:grid-cols-[1fr_360px] gap-6">
      <div className="space-y-6">
        <CartShopSelector deliveryLat={coords?.lat} deliveryLng={coords?.lng} />
        {/* Address */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-xl font-bold flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" /> Delivery address
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">Pin your exact spot on the map for the nearest shop and the fastest delivery.</p>
          <div className="mt-3">
            <LocationPicker value={coords} onChange={setCoords} />
          </div>
          <div className="mt-3 space-y-2">
            {addresses.data?.map((a) => (
              <label
                key={a.id}
                className={`flex items-start gap-3 rounded-2xl border-2 p-3 cursor-pointer ${selectedAddr === a.id ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <input
                  type="radio"
                  name="addr"
                  className="mt-1"
                  checked={selectedAddr === a.id}
                  onChange={() => setSelectedAddr(a.id)}
                />
                <div className="flex-1">
                  <div className="font-semibold">
                    {a.name} <span className="ml-2 text-xs rounded-full bg-secondary px-2 py-0.5">{a.type}</span>
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {a.line1}, {a.line2 ? `${a.line2}, ` : ""}{a.city}, {a.state} - {a.pincode}
                  </div>
                  <div className="text-xs text-muted-foreground">📞 {a.phone}</div>
                </div>
              </label>
            ))}
            {!showNew ? (
              <button
                onClick={() => setShowNew(true)}
                className="flex items-center gap-2 rounded-2xl border-2 border-dashed border-border px-4 py-3 w-full text-sm hover:border-primary"
              >
                <Plus className="h-4 w-4" /> Add a new address
              </button>
            ) : (
              <div className="rounded-2xl border-2 border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <FormInput id="n" label="Full name" v={newAddr.name} set={(v) => setNewAddr({ ...newAddr, name: v })} />
                  <FormInput id="p" label="Phone" v={newAddr.phone} set={(v) => setNewAddr({ ...newAddr, phone: v })} />
                </div>
                <FormInput id="l1" label="House / flat / building" v={newAddr.line1} set={(v) => setNewAddr({ ...newAddr, line1: v })} />
                <FormInput id="l2" label="Area / street (optional)" v={newAddr.line2} set={(v) => setNewAddr({ ...newAddr, line2: v })} />
                <FormInput id="lm" label="Landmark (optional)" v={newAddr.landmark} set={(v) => setNewAddr({ ...newAddr, landmark: v })} />
                <div className="grid sm:grid-cols-3 gap-3">
                  <FormInput id="c" label="City" v={newAddr.city} set={(v) => setNewAddr({ ...newAddr, city: v })} />
                  <FormInput id="s" label="State" v={newAddr.state} set={(v) => setNewAddr({ ...newAddr, state: v })} />
                  <FormInput id="pn" label="Pincode" v={newAddr.pincode} set={(v) => setNewAddr({ ...newAddr, pincode: v })} />
                </div>
                <div className="flex gap-2">
                  <Button onClick={saveNewAddress} className="rounded-xl gradient-primary text-primary-foreground">Save address</Button>
                  <Button variant="ghost" onClick={() => setShowNew(false)}>Cancel</Button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Delivery option */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-xl font-bold">Delivery option</h2>
          {activePincode && !zone.isLoading && !zone.data && (
            <p className="mt-2 text-xs text-amber-600">
              No delivery zone configured for PIN {activePincode}. Showing defaults; ask the admin to add this PIN Code.
            </p>
          )}
          <div className="mt-3 grid gap-3">
            {tiers.map((o) => {
              const disabled = o.minOrder != null && subtotal < o.minOrder;
              return (
                <label
                  key={o.id}
                  className={`flex items-center gap-3 rounded-2xl border-2 p-4 ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"} ${deliveryType === o.id ? "border-primary bg-primary/5" : "border-border"}`}
                >
                  <input
                    type="radio"
                    name="delivery_type"
                    disabled={disabled}
                    checked={deliveryType === o.id}
                    onChange={() => setDeliveryType(o.id)}
                  />
                  <span className="text-2xl leading-none">{o.icon}</span>
                  <div className="flex-1">
                    <div className="font-bold flex items-center justify-between">
                      <span>{o.title}</span>
                      <span className={`text-sm ${o.fee === 0 ? "text-primary" : "text-foreground"}`}>
                        {o.fee === 0 ? "Free" : `+${rupees(o.fee)}`}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground">{o.sub}</div>
                    {o.minOrder != null && (
                      <div className="text-[11px] text-muted-foreground">
                        Min order {rupees(o.minOrder)}{disabled ? ` — add ${rupees(o.minOrder - subtotal)} more` : ""}
                      </div>
                    )}
                  </div>
                </label>
              );
            })}
          </div>
        </section>

        {/* Instruction */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-xl font-bold">Delivery instructions</h2>
          <Textarea
            value={instruction}
            onChange={(e) => setInstruction(e.target.value)}
            placeholder="e.g., leave at the door, call on arrival…"
            className="mt-3 rounded-xl"
          />
        </section>

        {/* Payment */}
        <section className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h2 className="font-display text-xl font-bold">Payment method</h2>
          <div className="mt-3 grid sm:grid-cols-2 gap-3">
            <label className={`flex items-center gap-3 rounded-2xl border-2 p-4 cursor-pointer ${method === "cod" ? "border-primary bg-primary/5" : "border-border"}`}>
              <input type="radio" checked={method === "cod"} onChange={() => setMethod("cod")} />
              <Wallet className="h-5 w-5 text-primary" />
              <div>
                <div className="font-bold">Cash on Delivery</div>
                <div className="text-xs text-muted-foreground">Pay when your order arrives</div>
              </div>
            </label>
            <label className={`flex items-center gap-3 rounded-2xl border-2 p-4 cursor-pointer ${method === "razorpay" ? "border-primary bg-primary/5" : "border-border"}`}>
              <input type="radio" checked={method === "razorpay"} onChange={() => setMethod("razorpay")} />
              <CreditCard className="h-5 w-5 text-primary" />
              <div>
                <div className="font-bold">Online (Razorpay)</div>
                <div className="text-xs text-muted-foreground">UPI / Card / Netbanking (test mode)</div>
              </div>
            </label>
          </div>
          {method === "razorpay" && (
            <div className="mt-3 rounded-xl bg-primary/10 border border-primary/30 p-3 text-xs">
              Pay with UPI, debit/credit card, netbanking or wallet via Razorpay (currently in test mode).
            </div>
          )}
        </section>
      </div>

      {/* Summary */}
      <aside className="md:sticky md:top-24 self-start space-y-4">
        <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display text-lg font-bold mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-primary" /> Apply coupon
          </h3>
          {appliedCoupon ? (
            <div className="flex items-center justify-between rounded-xl border-2 border-primary/40 bg-primary/10 px-3 py-2">
              <div>
                <div className="font-bold text-sm">{appliedCoupon.code} applied</div>
                <div className="text-xs text-muted-foreground">You saved {rupees(appliedCoupon.discount)}</div>
              </div>
              <Button variant="ghost" size="sm" className="text-destructive" onClick={removeCoupon}>Remove</Button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input
                value={coupon}
                onChange={(e) => setCoupon(e.target.value.toUpperCase())}
                placeholder="FLASH50"
                className="rounded-xl uppercase"
                onKeyDown={(e) => e.key === "Enter" && applyCoupon()}
              />
              <Button variant="outline" className="rounded-xl" onClick={applyCoupon} disabled={applyingCoupon}>
                {applyingCoupon ? "…" : "Apply"}
              </Button>
            </div>
          )}
          <div className="mt-2 text-xs text-muted-foreground">Try FLASH50 (₹299+), SAVE10 (₹199+), or WELCOME (₹99+)</div>
        </div>

        <div className="rounded-3xl border border-border bg-card p-5 shadow-card">
          <h3 className="font-display text-lg font-bold mb-3">Bill summary</h3>
          <Row label={`Item total (${items.length})`} value={rupees(subtotal)} />
          {appliedCoupon && (
            <Row label={`Coupon (${appliedCoupon.code})`} value={`- ${rupees(appliedCoupon.discount)}`} />
          )}
          <Row label={selectedTier ? `${selectedTier.title} (${selectedTier.sub})` : "Delivery"} value={deliveryFee === 0 ? "FREE" : rupees(deliveryFee)} />
          <Row label="Handling" value={rupees(handling)} />
          <div className="my-3 h-px bg-border" />
          <Row label="To pay" value={rupees(total)} bold />
          {minOrderNotMet && selectedTier?.minOrder != null && (
            <div className="mt-2 text-xs text-destructive">
              Add {rupees(selectedTier.minOrder - subtotal)} more to use {selectedTier.title}.
            </div>
          )}
          <motion.div whileTap={{ scale: 0.97 }}>
            <Button
              disabled={placing || !selectedAddr || minOrderNotMet}
              onClick={place}
              className="mt-5 w-full h-12 rounded-xl gradient-primary text-primary-foreground font-bold shadow-glow"
            >
              <Zap className="h-4 w-4 mr-2 fill-current" /> {placing ? "Placing…" : `Place order • ${rupees(total)}`}
            </Button>
          </motion.div>
        </div>
      </aside>
    </div>
  );
}

function FormInput({ id, label, v, set }: { id: string; label: string; v: string; set: (v: string) => void }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">{label}</Label>
      <Input id={id} value={v} onChange={(e) => set(e.target.value)} className="h-10 rounded-xl" />
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between py-1 text-sm ${bold ? "text-base font-bold" : ""}`}>
      <span>{label}</span><span>{value}</span>
    </div>
  );
}
