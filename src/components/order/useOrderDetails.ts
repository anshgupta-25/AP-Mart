import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const LOW_STOCK_THRESHOLD = 5;

export type EnrichedItem = {
  id: string;
  name: string;
  brand: string | null;
  category: string | null;
  variantLabel: string | null;
  size: string | null;
  unit: string | null;
  sku: string | null;
  image: string | null;
  quantity: number;
  price: number;
  total: number;
  shopId: string | null;
  stockBefore: number | null;
  stockAfter: number | null;
  alreadyDeducted: boolean;
};

export type OrderDetails = {
  order: any;
  items: EnrichedItem[];
  children: any[];
  totalQuantity: number;
  productCount: number;
};

/** Statuses where stock has already been removed from the shop inventory. */
const DEDUCTED = new Set(["accepted_by_shop", "packed", "out_for_delivery", "delivered"]);

const pickImage = (item: any, product: any, variant: any): string | null =>
  item?.image_url ||
  variant?.images?.[0] ||
  product?.cover_image ||
  product?.image_gallery?.[0] ||
  product?.image_url ||
  null;

export function useOrderDetails(orderId: string, opts?: { shopId?: string | null; scopeToShop?: boolean; refetchInterval?: number }) {
  return useQuery<OrderDetails | null>({
    queryKey: ["order-details", orderId, opts?.shopId ?? null, opts?.scopeToShop ?? false],
    refetchInterval: opts?.refetchInterval,
    queryFn: async () => {
      const { data: order } = await supabase.from("orders").select("*").eq("id", orderId).maybeSingle();
      if (!order) return null;

      const [{ data: rawItems }, { data: children }] = await Promise.all([
        supabase.from("order_items").select("*").or(`order_id.eq.${orderId},child_order_id.eq.${orderId}`),
        (order as any).is_parent
          ? supabase.from("orders").select("*").eq("parent_order_id", orderId)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      let items = (rawItems ?? []) as any[];
      const scopeShop = opts?.shopId ?? (opts?.scopeToShop ? ((order as any).shop_id as string | null) : null);
      if (scopeShop) items = items.filter((i) => !i.shop_id || i.shop_id === scopeShop);

      const productIds = [...new Set(items.map((i) => i.product_id).filter(Boolean))];
      const variantIds = [...new Set(items.map((i) => i.variant_id).filter(Boolean))];
      const shopProductIds = [...new Set(items.map((i) => i.shop_product_id).filter(Boolean))];
      const shopIds = [...new Set(items.map((i) => i.shop_id).filter(Boolean))];
      if ((order as any).shop_id) shopIds.push((order as any).shop_id);

      const [products, variants, shopProducts] = await Promise.all([
        productIds.length
          ? supabase
              .from("products")
              .select("id, name, brand, unit, image_url, cover_image, image_gallery, category_id, categories(name)")
              .in("id", productIds)
              .then((r) => r.data ?? [])
          : Promise.resolve([]),
        variantIds.length
          ? supabase
              .from("product_variants")
              .select("id, name, size, unit, sku, images")
              .in("id", variantIds)
              .then((r) => r.data ?? [])
          : Promise.resolve([]),
        productIds.length && (shopIds.length || shopProductIds.length)
          ? supabase
              .from("shop_products")
              .select("id, shop_id, product_id, stock")
              .in("product_id", productIds)
              .then((r) => r.data ?? [])
          : Promise.resolve([]),
      ]);

      const pMap = new Map(products.map((p: any) => [p.id, p]));
      const vMap = new Map(variants.map((v: any) => [v.id, v]));
      const spById = new Map(shopProducts.map((s: any) => [s.id, s]));
      const spByShopProduct = new Map(shopProducts.map((s: any) => [`${s.shop_id}:${s.product_id}`, s]));

      const alreadyDeducted = DEDUCTED.has((order as any).status);

      const enriched: EnrichedItem[] = items.map((it) => {
        const p: any = pMap.get(it.product_id);
        const v: any = vMap.get(it.variant_id);
        const shopId = it.shop_id ?? (order as any).shop_id ?? null;
        const sp: any = spById.get(it.shop_product_id) ?? (shopId ? spByShopProduct.get(`${shopId}:${it.product_id}`) : null);
        const stockBefore = sp ? Number(sp.stock) : null;
        const qty = Number(it.quantity) || 0;
        return {
          id: it.id,
          name: it.name ?? p?.name ?? "Product",
          brand: p?.brand ?? null,
          category: p?.categories?.name ?? null,
          variantLabel: it.variant_label ?? v?.name ?? null,
          size: v?.size ?? null,
          unit: it.unit ?? v?.unit ?? p?.unit ?? null,
          sku: v?.sku ?? null,
          image: pickImage(it, p, v),
          quantity: qty,
          price: Number(it.price) || 0,
          total: (Number(it.price) || 0) * qty,
          shopId,
          stockBefore,
          stockAfter: stockBefore == null ? null : alreadyDeducted ? stockBefore : Math.max(0, stockBefore - qty),
          alreadyDeducted,
        };
      });

      return {
        order,
        items: enriched,
        children: (children ?? []) as any[],
        totalQuantity: enriched.reduce((s, i) => s + i.quantity, 0),
        productCount: enriched.length,
      };
    },
  });
}

export const stockTone = (stock: number | null) => {
  if (stock == null) return { label: "Unknown", cls: "bg-muted text-muted-foreground", dot: "⚪" };
  if (stock <= 0) return { label: "Out of stock", cls: "bg-destructive/15 text-destructive", dot: "🔴" };
  if (stock <= LOW_STOCK_THRESHOLD) return { label: "Low stock", cls: "bg-orange-500/15 text-orange-600", dot: "🟡" };
  return { label: "Healthy stock", cls: "bg-emerald-500/15 text-emerald-600", dot: "🟢" };
};
