import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";
import { resolvePricing } from "@/lib/pricing";

export interface CartLine {
  id: string;
  product_id: string;
  variant_id: string | null;
  shop_id: string | null;
  quantity: number;
  product: {
    id: string;
    name: string;
    slug: string;
    price: number;
    mrp: number;
    image_url: string | null;
    unit: string;
    stock: number;
  };
  variant?: {
    id: string;
    name: string | null;
    size: string;
    unit: string | null;
    selling_price: number;
    mrp: number;
    stock: number;
    images: string[];
    is_default?: boolean | null;
  } | null;
  shop?: {
    id: string;
    name: string;
    address: string | null;
    pincode: string | null;
    latitude: number | null;
    longitude: number | null;
  } | null;
  /** Shop-specific inventory pricing (authoritative for the base size). */
  shopPrice?: number | null;
  shopMrp?: number | null;
}


export class CartShopConflictError extends Error {
  constructor(
    public currentShopId: string,
    public newShopId: string,
    public currentShopName?: string,
    public newShopName?: string,
  ) {
    super("Cart contains items from a different shop");
    this.name = "CartShopConflictError";
  }
}

export function useCart() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const cartQuery = useQuery({
    queryKey: ["cart", user?.id],
    queryFn: async (): Promise<CartLine[]> => {
      if (!user) return [];
      const { data, error } = await (supabase as any)
        .from("cart_items")
        .select(
          "id, product_id, variant_id, shop_id, quantity, products(id, name, slug, price, mrp, image_url, unit, stock), product_variants:variant_id(id, name, size, unit, selling_price, mrp, stock, images, is_default), shops:shop_id(id, name, address, pincode, latitude, longitude)"
        )
        .eq("user_id", user.id);
      if (error) throw error;
      const rows = (data ?? []).filter((row: any) => row.products);

      // Pull the shop-specific inventory pricing so cart/checkout show exactly
      // the price the listing and detail page showed.
      const shopIds = [...new Set(rows.map((r: any) => r.shop_id).filter(Boolean))] as string[];
      const productIds = [...new Set(rows.map((r: any) => r.product_id))] as string[];
      let invMap = new Map<string, { price: number; mrp: number | null }>();
      if (shopIds.length && productIds.length) {
        const { data: inv } = await (supabase as any)
          .from("shop_products")
          .select("shop_id, product_id, price, mrp")
          .in("shop_id", shopIds)
          .in("product_id", productIds);
        invMap = new Map(
          (inv ?? []).map((r: any) => [`${r.shop_id}:${r.product_id}`, { price: Number(r.price), mrp: r.mrp == null ? null : Number(r.mrp) }]),
        );
      }

      return rows.map((row: any) => {
        const inv = row.shop_id ? invMap.get(`${row.shop_id}:${row.product_id}`) : undefined;
        return {
          id: row.id,
          product_id: row.product_id,
          variant_id: row.variant_id ?? null,
          shop_id: row.shop_id ?? null,
          quantity: row.quantity,
          product: row.products,
          variant: row.product_variants ?? null,
          shop: row.shops ?? null,
          shopPrice: inv?.price ?? null,
          shopMrp: inv?.mrp ?? null,
        };
      });
    },
    enabled: !!user,
  });

  const items = cartQuery.data ?? [];
  const pricingOf = (l: CartLine) =>
    resolvePricing({
      productPrice: l.product.price,
      productMrp: l.product.mrp,
      productStock: l.product.stock,
      variant: l.variant ?? null,
      shop: l.shopPrice != null ? { price: l.shopPrice, mrp: l.shopMrp } : null,
    });
  const priceOf = (l: CartLine) => pricingOf(l).price;
  const mrpOf = (l: CartLine) => pricingOf(l).mrp;
  const subtotal = items.reduce((s, l) => s + priceOf(l) * l.quantity, 0);
  const mrpTotal = items.reduce((s, l) => s + mrpOf(l) * l.quantity, 0);
  const savings = mrpTotal - subtotal;

  const totalQty = items.reduce((s, l) => s + l.quantity, 0);
  const currentShop = items.find((l) => l.shop)?.shop ?? null;
  const currentShopId = items.find((l) => l.shop_id)?.shop_id ?? null;

  const cartKey = ["cart", user?.id] as const;
  const snapshot = () => qc.getQueryData<CartLine[]>(cartKey) ?? [];
  const setLines = (lines: CartLine[]) => qc.setQueryData<CartLine[]>(cartKey, lines);

  const addMutation = useMutation({
    mutationFn: async ({
      productId,
      variantId = null,
      shopId = null,
      qty = 1,
      force = false,
    }: {
      productId: string;
      variantId?: string | null;
      shopId?: string | null;
      qty?: number;
      force?: boolean;
    }) => {
      if (!user) throw new Error("Please sign in to add to cart");

      // Detect shop conflict
      if (shopId && currentShopId && currentShopId !== shopId && !force) {
        const newShop = (await supabase.from("shops").select("name").eq("id", shopId).maybeSingle()).data;
        throw new CartShopConflictError(
          currentShopId,
          shopId,
          currentShop?.name,
          newShop?.name,
        );
      }

      // If forcing, clear existing cart first (different shop)
      if (force && currentShopId && currentShopId !== shopId) {
        const { error: dErr } = await supabase.from("cart_items").delete().eq("user_id", user.id);
        if (dErr) throw dErr;
      }

      const effectiveShopId = shopId ?? currentShopId;
      // Atomic server-side upsert: one row per (user, product). Concurrent
      // clicks or a stale local cache can never produce duplicate rows or
      // lost increments — the database resolves the conflict itself.
      const { error } = await (supabase as any).rpc("add_to_cart", {
        p_product_id: productId,
        p_qty: qty,
        p_variant_id: variantId ?? null,
        p_shop_id: effectiveShopId ?? null,
      });
      if (error) throw error;
    },
    // Optimistic: bump the quantity of an existing line right away so the
    // quantity stepper / cart badge react instantly.
    onMutate: async (vars) => {
      const previous = snapshot();
      const effectiveShopId = vars.shopId ?? currentShopId;
      const existing = previous.find(
        (l) =>
          l.product_id === vars.productId &&
          (l.variant_id ?? null) === (vars.variantId ?? null) &&
          (l.shop_id ?? null) === (effectiveShopId ?? null),
      );
      if (existing && !vars.force) {
        setLines(
          previous.map((l) =>
            l.id === existing.id ? { ...l, quantity: l.quantity + (vars.qty ?? 1) } : l,
          ),
        );
      }
      return { previous };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.previous) setLines(ctx.previous);
      if (e.name !== "CartShopConflictError") toast.error(e.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart", user?.id] }),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ lineId, qty }: { lineId: string; qty: number }) => {
      if (qty <= 0) {
        const { error } = await supabase.from("cart_items").delete().eq("id", lineId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cart_items").update({ quantity: qty }).eq("id", lineId);
        if (error) throw error;
      }
    },
    onMutate: async ({ lineId, qty }) => {
      const previous = snapshot();
      setLines(
        qty <= 0
          ? previous.filter((l) => l.id !== lineId)
          : previous.map((l) => (l.id === lineId ? { ...l, quantity: qty } : l)),
      );
      return { previous };
    },
    onError: (e: Error, _vars, ctx) => {
      if (ctx?.previous) setLines(ctx.previous);
      toast.error(e.message);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["cart", user?.id] }),
  });

  const changeShop = async (newShopId: string) => {
    if (!user) return;
    const previous = snapshot();
    // Instant UI: repoint every line at the new shop (single batched update below).
    setLines(previous.map((l) => ({ ...l, shop_id: newShopId, shop: l.shop ? { ...l.shop, id: newShopId } : l.shop })));
    const { error } = await supabase
      .from("cart_items")
      .update({ shop_id: newShopId })
      .eq("user_id", user.id);
    if (error) {
      setLines(previous);
      return toast.error(error.message);
    }
    toast.success("Shop updated");
    qc.invalidateQueries({ queryKey: ["cart", user.id] });
  };

  const clear = async () => {
    if (!user) return;
    const previous = snapshot();
    setLines([]);
    const { error } = await supabase.from("cart_items").delete().eq("user_id", user.id);
    if (error) {
      setLines(previous);
      toast.error("Could not clear cart: " + error.message);
      return;
    }
    qc.invalidateQueries({ queryKey: ["cart", user.id] });
  };

  return {
    items,
    subtotal,
    mrpTotal,
    savings,
    totalQty,
    currentShop,
    currentShopId,
    priceOf,
    mrpOf,
    loading: cartQuery.isLoading,

    add: (productId: string, qty = 1, variantId: string | null = null, shopId: string | null = null) =>
      addMutation.mutateAsync({ productId, variantId, shopId, qty }),
    addForce: (productId: string, qty = 1, variantId: string | null = null, shopId: string | null = null) =>
      addMutation.mutateAsync({ productId, variantId, shopId, qty, force: true }),
    setQty: (lineId: string, qty: number) => updateMutation.mutate({ lineId, qty }),
    changeShop,
    clear,
  };
}

