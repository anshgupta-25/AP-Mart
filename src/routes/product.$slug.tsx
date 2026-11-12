import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Clock, Star, ShieldCheck, Truck, Minus, Plus, ChevronLeft, ChevronRight, X, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart, CartShopConflictError } from "@/hooks/useCart";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
import { ShopPicker, useEligibleShops, type EligibleShop } from "@/components/ShopPicker";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/format";
import { resolvePricing } from "@/lib/pricing";

import { Skeleton } from "@/components/ui/skeleton";
import { ProductImage } from "@/components/ProductImage";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StorageImg } from "@/components/StorageImg";


export const Route = createFileRoute("/product/$slug")({
  head: ({ params }) => ({ meta: [{ title: `${params.slug} — AP Mart` }] }),
  component: ProductPage,
});

type Variant = {
  id: string;
  name: string | null;
  size: string;
  unit: string | null;
  weight: string | null;
  mrp: number;
  selling_price: number;
  retail_price: number;
  stock: number;
  images: string[];
  is_available: boolean;
  is_default: boolean;
  display_order: number;
};

function ProductPage() {
  const { slug } = Route.useParams();
  const { items, add, addForce, setQty, currentShop } = useCart();
  const delivery = useDeliveryContext();

  const product = useQuery({
    queryKey: ["product", slug],
    queryFn: async () => (await supabase.from("products").select("*").eq("slug", slug).maybeSingle()).data,
  });

  const variantsQ = useQuery({
    queryKey: ["product-variants", product.data?.id],
    enabled: !!product.data?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("product_variants")
        .select("*")
        .eq("product_id", product.data!.id)
        .eq("is_available", true)
        .order("display_order", { ascending: true });
      if (error) throw error;
      return (data ?? []) as Variant[];
    },
  });

  const settings = useQuery({
    queryKey: ["app-config", "enable_customer_shop_selection"],
    queryFn: async () => {
      const { data } = await supabase.from("app_config").select("value").eq("key", "enable_customer_shop_selection").maybeSingle();
      const raw = (data as any)?.value;
      return raw === false || raw === "false" ? false : true;
    },
  });
  const shopSelectionEnabled = settings.data ?? true;

  const variants = variantsQ.data ?? [];
  const hasVariants = variants.length > 0;
  const defaultVariant = useMemo(
    () => variants.find((v) => v.is_default) ?? variants[0],
    [variants],
  );
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = hasVariants ? (variants.find((v) => v.id === selectedId) ?? defaultVariant) : null;

  const eligibleQ = useEligibleShops({
    productId: product.data?.id,
    variantId: selected?.id ?? null,
    pincode: delivery.pincode,
    lat: delivery.lat,
    lng: delivery.lng,
    enabled: !!product.data?.id,
  });
  const eligibleShops = eligibleQ.data ?? [];

  // Base (default-size) shop inventory — variant-independent, so switching the
  // selected variant never rewrites the price shown on the other variant chips.
  const baseShopsQ = useEligibleShops({
    productId: product.data?.id,
    variantId: null,
    pincode: delivery.pincode,
    lat: delivery.lat,
    lng: delivery.lng,
    enabled: !!product.data?.id,
  });
  const baseShops = baseShopsQ.data ?? [];


  // Open vs closed shops carrying this item — drives the "Currently Unavailable" state
  const availabilityQ = useQuery({
    queryKey: ["product-availability", product.data?.id, selected?.id ?? null, delivery.pincode, delivery.lat, delivery.lng],
    enabled: !!product.data?.id,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc("product_shop_availability", {
        _product_id: product.data!.id,
        _variant_id: selected?.id ?? null,
        _pincode: delivery.pincode ?? null,
        _lat: delivery.lat,
        _lng: delivery.lng,
      });
      if (error) throw error;
      const row = (Array.isArray(data) ? data[0] : data) ?? null;
      return { open: Number(row?.open_shops ?? 0), closed: Number(row?.closed_shops ?? 0) };
    },
  });
  const allShopsClosed =
    !availabilityQ.isLoading &&
    (availabilityQ.data?.open ?? 0) === 0 &&
    (availabilityQ.data?.closed ?? 0) > 0;

  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const selectedShop: EligibleShop | null = useMemo(() => {
    if (eligibleShops.length === 0) return null;
    if (selectedShopId) {
      const found = eligibleShops.find((s) => s.shop_id === selectedShopId);
      if (found) return found;
    }
    // If a shop is already locked in via the cart, prefer it
    if (currentShop) {
      const inCart = eligibleShops.find((s) => s.shop_id === currentShop.id);
      if (inCart) return inCart;
    }
    return eligibleShops[0];
  }, [eligibleShops, selectedShopId, currentShop]);

  // Pricing always reads the variant-independent base inventory record for the
  // chosen shop, so a variant switch can't leak its price into other variants.
  const pricingShop: EligibleShop | null = useMemo(() => {
    if (!selectedShop) return null;
    return baseShops.find((s) => s.shop_id === selectedShop.shop_id) ?? selectedShop;
  }, [baseShops, selectedShop]);

  const [conflict, setConflict] = useState<{ productId: string; variantId: string | null; shopId: string } | null>(null);
  const [priceChange, setPriceChange] = useState<{ oldPrice: number; newPrice: number } | null>(null);



  if (product.isLoading) return <div className="mx-auto max-w-7xl px-4 py-10"><Skeleton className="h-96" /></div>;
  if (!product.data) return <div className="mx-auto max-w-7xl px-4 py-20 text-center">Product not found.</div>;

  const p = product.data;

  // Single pricing source shared with the product cards / cart: the selected
  // shop's inventory record wins for the base size, variants keep their own price.
  const pricing = resolvePricing({
    productPrice: p.price,
    productMrp: p.mrp,
    productStock: p.stock,
    variant: selected,
    shop: pricingShop,
  });
  const effPrice = pricing.price;
  const effMrp = pricing.mrp;
  const effStock = pricing.stock;
  const effImages = selected && selected.images.length > 0 ? selected.images : buildImageList(p);
  const effUnit = selected ? `${selected.size}${selected.unit ? " " + selected.unit : ""}` : p.unit;
  const effDeliveryMinutes = selectedShop?.delivery_minutes ?? p.delivery_minutes;

  const line = items.find(
    (l) =>
      l.product_id === p.id &&
      (l.variant_id ?? null) === (selected?.id ?? null) &&
      (l.shop_id ?? null) === (selectedShop?.shop_id ?? null),
  );
  const discount = pricing.discount;


  async function doAdd() {
    try {
      await add(p.id, 1, selected?.id ?? null, selectedShop?.shop_id ?? null);
    } catch (e) {
      if (e instanceof CartShopConflictError) {
        setConflict({ productId: p.id, variantId: selected?.id ?? null, shopId: selectedShop!.shop_id });
      }
    }
  }

  async function handleAdd() {
    if (allShopsClosed) {
      toast.error("Sorry, all shops selling this product are currently closed.");
      return;
    }
    if (!selectedShop && eligibleShops.length === 0 && delivery.pincode) {
      toast.error("No shop currently delivers this item to your address.");
      return;
    }

    // Re-validate the shop price at add time; never silently change it.
    if (selectedShop) {
      const fresh = await baseShopsQ.refetch();
      const freshShop = (fresh.data ?? []).find((s) => s.shop_id === selectedShop.shop_id);
      if (freshShop) {
        const freshPrice = resolvePricing({
          productPrice: p.price,
          productMrp: p.mrp,
          productStock: p.stock,
          variant: selected,
          shop: freshShop,
        }).price;
        if (Math.round(freshPrice) !== Math.round(effPrice)) {
          setPriceChange({ oldPrice: effPrice, newPrice: freshPrice });
          return;
        }
      }
    }

    await doAdd();
  }


  async function confirmSwitchShop() {
    if (!conflict) return;
    try {
      await addForce(conflict.productId, 1, conflict.variantId, conflict.shopId);
      toast.success("Cart cleared and item added");
    } catch {
      /* toast handled in hook */
    } finally {
      setConflict(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <Link to="/products" className="text-sm text-muted-foreground hover:underline">← All products</Link>

      <div className="mt-4 grid md:grid-cols-2 gap-8">
        <motion.div
          key={`${selected?.id ?? "base"}-${selectedShop?.shop_id ?? "none"}`}
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <ProductGallery name={p.name} images={effImages} />
        </motion.div>

        <div>
          <div className="inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground">
            <Clock className="h-3 w-3" /> Delivery in {effDeliveryMinutes} mins
          </div>
          <h1 className="mt-2 font-display text-3xl md:text-4xl font-extrabold">{p.name}</h1>
          {p.brand && <div className="text-muted-foreground mt-1">{p.brand}</div>}
          <div className="text-sm text-muted-foreground">{effUnit}</div>

          <div className="mt-3 flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center gap-1 rounded-md bg-success/20 text-success-foreground px-2 py-1 text-xs font-semibold">
              <Star className="h-3 w-3 fill-current" /> {p.rating}
            </div>
            {selectedShop && (
              <div className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-1 text-xs font-semibold">
                <Store className="h-3 w-3" /> {selectedShop.shop_name}
              </div>
            )}
          </div>

          {hasVariants && (
            <div className="mt-5">
              <div className="text-xs font-bold uppercase text-muted-foreground tracking-wide mb-2">
                Choose an option
              </div>
              <div className="flex flex-wrap gap-2">
                {variants.map((v) => {
                  const active = selected?.id === v.id;
                  const oos = v.stock <= 0;
                  const vp = resolvePricing({
                    productPrice: p.price,
                    productMrp: p.mrp,
                    productStock: p.stock,
                    variant: v,
                    shop: pricingShop,
                  });
                  return (
                    <button
                      key={v.id}
                      type="button"
                      disabled={oos}
                      onClick={() => setSelectedId(v.id)}
                      className={`rounded-xl border-2 px-3 py-2 text-left transition ${
                        active ? "border-primary bg-primary/5" : "border-border hover:border-primary/50"
                      } ${oos ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="text-sm font-bold">
                        {v.size}
                        {v.unit ? ` ${v.unit}` : ""}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-xs">
                        <span className="font-extrabold text-foreground">{rupees(vp.price)}</span>
                        {vp.mrp > vp.price && (
                          <span className="text-muted-foreground line-through">{rupees(vp.mrp)}</span>
                        )}
                        {vp.discount > 0 && (
                          <span className="font-bold text-success">{vp.discount}% off</span>
                        )}
                        {oos && <span className="ml-1 text-destructive">Out</span>}
                      </div>

                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="mt-4 flex items-end gap-3">
            <div className="text-3xl font-bold">{rupees(effPrice)}</div>
            {effMrp > effPrice && (
              <>
                <div className="text-lg text-muted-foreground line-through">{rupees(effMrp)}</div>
                <div className="rounded-md gradient-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                  {discount}% OFF
                </div>
              </>
            )}
          </div>
          <div className="text-xs text-muted-foreground">(Inclusive of all taxes)</div>

          <div className="mt-6 flex gap-3">
            {allShopsClosed ? (
              <Button disabled size="lg" className="rounded-xl h-12">Currently Unavailable</Button>
            ) : effStock <= 0 ? (
              <Button disabled size="lg" className="rounded-xl">Out of stock</Button>
            ) : line ? (
              <div className="flex items-center gap-1 rounded-xl gradient-primary text-primary-foreground">
                <button onClick={() => setQty(line.id, line.quantity - 1)} className="h-12 w-12 grid place-items-center"><Minus /></button>
                <span className="w-12 text-center font-bold">{line.quantity}</span>
                <button onClick={() => setQty(line.id, line.quantity + 1)} className="h-12 w-12 grid place-items-center"><Plus /></button>
              </div>
            ) : (
              <Button size="lg" onClick={handleAdd} className="rounded-xl gradient-primary text-primary-foreground font-bold h-12 px-8 shadow-glow">
                Add to cart
              </Button>
            )}
            <Link to="/customer/cart" className="inline-flex items-center rounded-xl border-2 border-foreground px-6 font-bold hover:bg-foreground hover:text-background transition">
              Go to cart
            </Link>
          </div>

          {allShopsClosed && (
            <div className="mt-4 rounded-2xl border-2 border-destructive/30 bg-destructive/5 p-4 text-sm font-semibold text-destructive">
              Sorry, all shops selling this product are currently closed.
            </div>
          )}

          {/* Available shops picker */}
          {shopSelectionEnabled && eligibleShops.length > 1 && (
            <div className="mt-8">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-display text-xl font-bold flex items-center gap-2">
                  <Store className="h-5 w-5 text-primary" /> Available shops
                </h3>
                <span className="text-xs text-muted-foreground">{eligibleShops.length} shops</span>
              </div>
              <ShopPicker
                shops={eligibleShops}
                loading={eligibleQ.isLoading}
                selectedShopId={selectedShop?.shop_id ?? null}
                onSelect={(s) => setSelectedShopId(s.shop_id)}
              />
            </div>
          )}

          {shopSelectionEnabled && !allShopsClosed && eligibleShops.length === 0 && delivery.pincode && !eligibleQ.isLoading && (
            <div className="mt-6 rounded-2xl border border-dashed border-border p-4 text-sm text-muted-foreground">
              No shop in your area ({delivery.pincode}) currently has this item in stock.
            </div>
          )}


          <div className="mt-8 grid grid-cols-3 gap-2">
            <Perk icon={<Clock className="h-4 w-4" />} title="Super fast" sub={`${effDeliveryMinutes} min delivery`} />
            <Perk icon={<Truck className="h-4 w-4" />} title="Free shipping" sub="Above ₹199" />
            <Perk icon={<ShieldCheck className="h-4 w-4" />} title="100% authentic" sub="Quality assured" />
          </div>

          {p.description && (
            <div className="mt-8">
              <h3 className="font-display text-xl font-bold">Product details</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{p.description}</p>
            </div>
          )}
        </div>
      </div>

      <AlertDialog open={!!priceChange} onOpenChange={(v) => !v && setPriceChange(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Price updated</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-1">
                <div>The shop updated this item's price.</div>
                <div>Old price: <span className="line-through">{rupees(priceChange?.oldPrice ?? 0)}</span></div>
                <div className="font-semibold text-foreground">New price: {rupees(priceChange?.newPrice ?? 0)}</div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setPriceChange(null);
                await doAdd();
              }}
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>


      <AlertDialog open={!!conflict} onOpenChange={(v) => !v && setConflict(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Different shop in your cart</AlertDialogTitle>
            <AlertDialogDescription>
              This product belongs to a different shop. A cart can only contain items from one shop.
              Would you like to clear your current cart and switch shops?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current cart</AlertDialogCancel>
            <AlertDialogAction onClick={confirmSwitchShop}>Clear cart & switch</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}


function Perk({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3 text-center shadow-card">
      <div className="grid place-items-center text-primary">{icon}</div>
      <div className="text-xs font-bold mt-1">{title}</div>
      <div className="text-[10px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function buildImageList(p: any): string[] {
  const list: string[] = [];
  const cover = p.cover_image ?? p.image_url ?? null;
  if (cover) list.push(cover);
  const gallery: string[] = Array.isArray(p.image_gallery) ? p.image_gallery : [];
  for (const url of gallery) {
    if (url && !list.includes(url)) list.push(url);
  }
  return list;
}

function ProductGallery({ images, name }: { images: string[]; name: string }) {
  const [idx, setIdx] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [touchX, setTouchX] = useState<number | null>(null);

  if (images.length === 0) {
    return (
      <div className="rounded-3xl bg-card border border-border shadow-card overflow-hidden aspect-square grid place-items-center text-8xl">
        🛒
      </div>
    );
  }

  const safeIdx = Math.min(idx, images.length - 1);
  const go = (delta: number) => setIdx((i) => (i + delta + images.length) % images.length);

  return (
    <>
      <div className="rounded-3xl bg-card border border-border shadow-card overflow-hidden relative">
        <div
          className="relative aspect-square cursor-zoom-in select-none"
          onClick={() => setZoom(true)}
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            setTouchX(null);
          }}
        >
          <ProductImage src={images[safeIdx]} alt={name} className="absolute inset-0 h-full w-full" eager />
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); go(-1); }}
                className="hidden md:grid place-items-center absolute left-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/80 hover:bg-background"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); go(1); }}
                className="hidden md:grid place-items-center absolute right-2 top-1/2 -translate-y-1/2 h-9 w-9 rounded-full bg-background/80 hover:bg-background"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                    className={`h-1.5 rounded-full transition-all ${i === safeIdx ? "w-6 bg-primary" : "w-1.5 bg-background/70"}`}
                    aria-label={`Go to image ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className="flex gap-2 p-2 overflow-x-auto border-t border-border">
            {images.map((url, i) => (
              <button
                key={url + i}
                type="button"
                onClick={() => setIdx(i)}
                className={`shrink-0 h-14 w-14 rounded-lg overflow-hidden border-2 transition ${i === safeIdx ? "border-primary" : "border-transparent opacity-70 hover:opacity-100"}`}
              >
                <ProductImage src={url} alt="" className="h-full w-full" fallbackClassName="text-lg" />
              </button>
            ))}
          </div>
        )}
      </div>

      {zoom && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 grid place-items-center p-4"
          onClick={() => setZoom(false)}
        >
          <button
            type="button"
            className="absolute top-4 right-4 h-10 w-10 grid place-items-center rounded-full bg-white/10 text-white"
            aria-label="Close zoom"
          >
            <X className="h-5 w-5" />
          </button>
          <StorageImg
            src={images[safeIdx]}
            alt={name}
            className="max-h-[90vh] max-w-[95vw] object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </>
  );
}
