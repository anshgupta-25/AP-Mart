import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Star, ShieldCheck, Truck, Minus, Plus, ChevronLeft, ChevronRight, ChevronDown, ArrowLeft, X, Store } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCart, CartShopConflictError } from "@/hooks/useCart";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
import { ShopPicker, useEligibleShops, type EligibleShop } from "@/components/ShopPicker";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/format";
import { resolvePricing } from "@/lib/pricing";
import { useCustomerProducts } from "@/hooks/useCustomerProducts";
import { ProductRail } from "@/components/customer/ProductRail";

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

  const similar = useCustomerProducts({
    categoryId: (product.data as any)?.category_id ?? null,
    limit: 14,
    key: `similar:${slug}`,
    enabled: !!(product.data as any)?.category_id,
  });

  const [conflict, setConflict] = useState<{ productId: string; variantId: string | null; shopId: string } | null>(null);
  const [priceChange, setPriceChange] = useState<{ oldPrice: number; newPrice: number } | null>(null);



  if (product.isLoading) return <div className="mx-auto max-w-6xl px-4 py-6"><Skeleton className="aspect-square w-full rounded-2xl" /></div>;
  if (!product.data) return <div className="mx-auto max-w-6xl px-4 py-20 text-center text-meta text-muted-foreground">Product not found.</div>;

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
    <div className="mx-auto max-w-6xl px-4 pb-44 pt-3 md:pb-10 md:pt-5">
      <Link to="/products" className="press inline-flex items-center gap-1 text-meta font-medium text-muted-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> All products
      </Link>

      <div className="mt-3 grid gap-5 md:grid-cols-2 md:gap-10">
        <div>
          <ProductGallery name={p.name} images={effImages} />
        </div>

        <div>
          {p.brand && <div className="eyebrow">{p.brand}</div>}
          <h1 className="mt-0.5 text-subtitle font-semibold leading-[1.25] tracking-tight">{p.name}</h1>
          <div className="mt-1.5 inline-flex items-center rounded-md bg-secondary px-2 py-0.5 text-small font-medium text-foreground/80">
            {effUnit}
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-full bg-tint-sun px-2 py-0.5 text-caption font-semibold text-accent-foreground">
              <Star className="h-3 w-3 fill-current" /> {p.rating}
            </div>
            {selectedShop && (
              <div className="inline-flex items-center gap-1 text-small text-muted-foreground">
                <Clock className="h-3 w-3" /> About {effDeliveryMinutes} min from this shop
              </div>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2.5">
            <div className="text-page font-bold leading-none tracking-tight">{rupees(effPrice)}</div>
            {effMrp > effPrice && (
              <>
                <div className="text-meta text-muted-foreground line-through">{rupees(effMrp)}</div>
                <div className="rounded-full bg-primary-soft px-2 py-0.5 text-caption font-semibold text-primary-ink">
                  {discount}% OFF
                </div>
              </>
            )}
          </div>
          <div className="mt-1 text-caption text-muted-foreground">Inclusive of all taxes</div>

          {selectedShop && (
            <div className="mt-4 flex items-center gap-3 rounded-xl border border-border/70 bg-card px-3 py-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tint-mint text-primary-ink">
                <Store className="h-4 w-4" />
              </span>
              <div className="min-w-0 flex-1 leading-tight">
                <div className="text-caption text-muted-foreground">Sold by</div>
                <div className="truncate text-meta font-semibold">{selectedShop.shop_name}</div>
              </div>
              {shopSelectionEnabled && eligibleShops.length > 1 && (
                <span className="text-caption font-medium text-muted-foreground">{eligibleShops.length} shops</span>
              )}
            </div>
          )}

          {hasVariants && (
            <div className="mt-4">
              <div className="eyebrow mb-2">Choose an option</div>
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
                      className={`press rounded-xl px-3 py-2 text-left transition ${
                        active ? "bg-primary-soft ring-1 ring-primary" : "border border-border/70 bg-card"
                      } ${oos ? "opacity-50 cursor-not-allowed" : ""}`}
                    >
                      <div className="text-meta font-semibold">
                        {v.size}
                        {v.unit ? ` ${v.unit}` : ""}
                      </div>
                      <div className="mt-0.5 flex items-center gap-1 text-caption">
                        <span className="font-semibold text-foreground">{rupees(vp.price)}</span>
                        {vp.mrp > vp.price && (
                          <span className="text-muted-foreground line-through">{rupees(vp.mrp)}</span>
                        )}
                        {vp.discount > 0 && (
                          <span className="font-semibold text-primary">{vp.discount}% off</span>
                        )}
                        {oos && <span className="ml-1 text-destructive">Out</span>}
                      </div>

                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bar-blur hairline-t fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-30 flex items-center gap-3 px-4 py-2.5 md:static md:z-auto md:mt-6 md:bg-transparent md:p-0 md:shadow-none">
            <div className="shrink-0 leading-tight md:hidden">
              <div className="text-subtitle font-bold">{rupees(effPrice)}</div>
              {effMrp > effPrice && (
                <div className="text-caption text-muted-foreground line-through">{rupees(effMrp)}</div>
              )}
            </div>
            {allShopsClosed ? (
              <Button disabled className="h-11 flex-1 rounded-xl md:flex-none">Currently unavailable</Button>
            ) : effStock <= 0 ? (
              <Button disabled className="h-11 flex-1 rounded-xl md:flex-none">Out of stock</Button>
            ) : line ? (
              <div className="flex h-11 flex-1 items-center justify-between rounded-xl bg-primary text-primary-foreground md:w-40 md:flex-none">
                <button onClick={() => setQty(line.id, line.quantity - 1)} className="grid h-11 w-12 place-items-center" aria-label="Decrease"><Minus className="h-4 w-4" /></button>
                <span className="w-8 text-center text-body font-semibold">{line.quantity}</span>
                <button onClick={() => setQty(line.id, line.quantity + 1)} className="grid h-11 w-12 place-items-center" aria-label="Increase"><Plus className="h-4 w-4" /></button>
              </div>
            ) : (
              <Button onClick={handleAdd} className="h-11 flex-1 rounded-xl px-8 md:flex-none">
                Add to cart
              </Button>
            )}
            <Link to="/customer/cart" className="press hidden h-11 items-center rounded-xl bg-secondary px-4 text-body font-semibold md:inline-flex">
              Go to cart
            </Link>
          </div>

          {allShopsClosed && (
            <div className="mt-4 rounded-xl bg-destructive/10 p-3 text-meta font-medium text-destructive">
              Sorry, all shops selling this product are currently closed.
            </div>
          )}

          {/* Available shops picker */}
          {shopSelectionEnabled && eligibleShops.length > 1 && (
            <div className="mt-6">
              <div className="mb-2.5 flex items-center justify-between">
                <h3 className="section-title">Available shops</h3>
                <span className="text-small text-muted-foreground">{eligibleShops.length} nearby</span>
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
            <div className="mt-5 rounded-xl bg-secondary p-3 text-meta text-muted-foreground">
              No shop in your area ({delivery.pincode}) currently has this item in stock.
            </div>
          )}


          <div className="mt-6 divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card">
            <Perk icon={<Store className="h-4 w-4" />} title="Sold by local shops" sub="Stocked and packed by stores near you" />
            <Perk icon={<Truck className="h-4 w-4" />} title="Delivered to your door" sub="Free delivery on orders above ₹199" />
            <Perk icon={<ShieldCheck className="h-4 w-4" />} title="Quality assured" sub="Fresh and authentic products" />
          </div>

          {p.description && (
            <details className="group mt-3 rounded-xl border border-border/70 bg-card px-3.5 py-3">
              <summary className="flex cursor-pointer list-none items-center justify-between text-body font-semibold">
                Product details
                <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform group-open:rotate-180" />
              </summary>
              <p className="mt-2 text-meta leading-relaxed text-muted-foreground">{p.description}</p>
            </details>
          )}
        </div>
      </div>

      {similar.data && similar.data.filter((x) => x.id !== p.id).length > 0 && (
        <div className="-mx-4 mt-8">
          <ProductRail title="Similar products" products={similar.data.filter((x) => x.id !== p.id)} />
        </div>
      )}

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
    <div className="flex items-center gap-3 px-3.5 py-2.5">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-tint-mint text-primary-ink">{icon}</span>
      <div className="min-w-0">
        <div className="text-meta font-semibold leading-tight">{title}</div>
        <div className="mt-0.5 text-small text-muted-foreground">{sub}</div>
      </div>
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
      <div className="grid aspect-[5/4] place-items-center overflow-hidden rounded-2xl bg-secondary/60 text-6xl">
        🛒
      </div>
    );
  }

  const safeIdx = Math.min(idx, images.length - 1);
  const go = (delta: number) => setIdx((i) => (i + delta + images.length) % images.length);

  return (
    <>
      <div className="relative overflow-hidden rounded-2xl bg-secondary/60">
        <div
          className="relative aspect-[5/4] cursor-zoom-in select-none"
          onClick={() => setZoom(true)}
          onTouchStart={(e) => setTouchX(e.touches[0].clientX)}
          onTouchEnd={(e) => {
            if (touchX === null) return;
            const dx = e.changedTouches[0].clientX - touchX;
            if (Math.abs(dx) > 40) go(dx < 0 ? 1 : -1);
            setTouchX(null);
          }}
        >
          <ProductImage src={images[safeIdx]} alt={name} fit="contain" className="absolute inset-0 h-full w-full bg-transparent p-4" eager />
          {images.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); go(-1); }}
                className="absolute left-3 top-1/2 hidden h-8 w-8 bg-card -translate-y-1/2 place-items-center rounded-full md:grid"
                aria-label="Previous image"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); go(1); }}
                className="absolute right-3 top-1/2 hidden h-8 w-8 bg-card -translate-y-1/2 place-items-center rounded-full md:grid"
                aria-label="Next image"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
              <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 flex gap-1.5">
                {images.map((_, i) => (
                  <button
                    key={i}
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setIdx(i); }}
                    className={`h-1.5 rounded-full transition-all ${i === safeIdx ? "w-5 bg-foreground" : "w-1.5 bg-foreground/20"}`}
                    aria-label={`Go to image ${i + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>
        {images.length > 1 && (
          <div className="scrollbar-hide flex gap-2 overflow-x-auto px-3 pb-3">
            {images.map((url, i) => (
              <button
                key={url + i}
                type="button"
                onClick={() => setIdx(i)}
                className={`shrink-0 h-12 w-12 rounded-lg overflow-hidden bg-card ring-2 transition ${i === safeIdx ? "ring-primary" : "ring-transparent opacity-70 hover:opacity-100"}`}
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
