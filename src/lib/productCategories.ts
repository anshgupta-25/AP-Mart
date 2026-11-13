import { supabase } from "@/integrations/supabase/client";

export const MAX_PRODUCT_CATEGORIES = 5;

/** Category ids linked to a product (falls back to products.category_id). */
export async function loadProductCategories(
  productId: string,
  fallbackCategoryId?: string | null,
): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from("product_categories")
    .select("category_id")
    .eq("product_id", productId);
  if (error) throw error;
  const ids = ((data ?? []) as { category_id: string }[]).map((r) => r.category_id);
  if (ids.length === 0 && fallbackCategoryId) return [fallbackCategoryId];
  return ids;
}

/** Fetch category ids for many products at once → map productId -> ids. */
export async function loadProductCategoriesMap(
  productIds: string[],
): Promise<Record<string, string[]>> {
  if (productIds.length === 0) return {};
  // One .in() with hundreds of UUIDs overflows the request URL limit, so batch it.
  const CHUNK = 100;
  const chunks: string[][] = [];
  for (let i = 0; i < productIds.length; i += CHUNK) chunks.push(productIds.slice(i, i + CHUNK));
  const results = await Promise.all(
    chunks.map(async (ids) => {
      const { data, error } = await (supabase as any)
        .from("product_categories")
        .select("product_id, category_id")
        .in("product_id", ids);
      if (error) throw error;
      return (data ?? []) as { product_id: string; category_id: string }[];
    }),
  );
  const map: Record<string, string[]> = {};
  for (const r of results.flat()) {
    (map[r.product_id] ??= []).push(r.category_id);
  }
  return map;
}

/** Replace a product's category links with `categoryIds` (deduped). */
export async function saveProductCategories(productId: string, categoryIds: string[]) {
  const ids = Array.from(new Set(categoryIds.filter(Boolean)));
  const { data, error } = await (supabase as any)
    .from("product_categories")
    .select("id, category_id")
    .eq("product_id", productId);
  if (error) throw error;
  const existing = (data ?? []) as { id: string; category_id: string }[];

  const toDelete = existing.filter((e) => !ids.includes(e.category_id)).map((e) => e.id);
  const existingIds = existing.map((e) => e.category_id);
  const toInsert = ids
    .filter((cid) => !existingIds.includes(cid))
    .map((cid) => ({ product_id: productId, category_id: cid }));

  if (toDelete.length > 0) {
    const { error: dErr } = await (supabase as any)
      .from("product_categories")
      .delete()
      .in("id", toDelete);
    if (dErr) throw dErr;
  }
  if (toInsert.length > 0) {
    const { error: iErr } = await (supabase as any).from("product_categories").insert(toInsert);
    if (iErr) throw iErr;
  }
}
