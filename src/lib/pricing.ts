/**
 * Single source of truth for customer-facing pricing.
 *
 * Rules (must match list_customer_products / list_eligible_shops_for_product):
 * - The shop inventory record (shop_products) is authoritative for the base /
 *   default size — different shops may sell the same product at different prices.
 * - A non-default variant uses its own catalog variant pricing.
 * - MRP is always kept separate from the selling price and is never rendered
 *   below the selling price.
 */

export interface PricingVariant {
  selling_price: number;
  mrp: number;
  stock: number;
  is_default?: boolean | null;
}

export interface PricingShop {
  price: number;
  mrp?: number | null;
  stock?: number | null;
}

export interface ResolvedPricing {
  price: number;
  mrp: number;
  discount: number;
  stock: number;
}

export function pctOff(price: number, mrp: number) {
  if (!mrp || mrp <= price) return 0;
  return Math.round(((mrp - price) / mrp) * 100);
}

export function resolvePricing(args: {
  productPrice: number;
  productMrp: number;
  productStock?: number;
  variant?: PricingVariant | null;
  shop?: PricingShop | null;
}): ResolvedPricing {
  const { productPrice, productMrp, productStock = 0, variant, shop } = args;

  // Base size = no variant at all, or the default variant of the product.
  const isBaseSize = !variant || variant.is_default !== false;

  let price: number;
  let mrpRaw: number;
  let stock: number;

  if (isBaseSize && shop) {
    price = Number(shop.price);
    mrpRaw = Number(shop.mrp ?? productMrp ?? price);
    stock = Number(shop.stock ?? productStock);
  } else if (variant) {
    price = Number(variant.selling_price);
    mrpRaw = Number(variant.mrp || productMrp || price);
    stock = shop?.stock != null ? Math.min(Number(variant.stock), Number(shop.stock)) : Number(variant.stock);
  } else {
    price = Number(productPrice);
    mrpRaw = Number(productMrp || price);
    stock = Number(productStock);
  }

  const mrp = Math.max(price, mrpRaw || price);
  return { price, mrp, discount: pctOff(price, mrp), stock };
}
