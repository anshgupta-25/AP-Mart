import { supabase } from "@/integrations/supabase/client";

/**
 * Product ↔ subcategory links. A product belongs to ONE main category but can
 * sit under several of that category's subcategories (Blinkit-style hierarchy).
 */
export async function loadProductSubcategories(
  productId: string,
  fallbackSubcategoryId?: string | null,
): Promise<string[]> {
  const { data, error } = await (supabase as any)
    .from("product_subcategories")
    .select("subcategory_id")
    .eq("product_id", productId);
  if (error) throw error;
  const ids = ((data ?? []) as { subcategory_id: string }[]).map((r) => r.subcategory_id);
  if (ids.length === 0 && fallbackSubcategoryId) return [fallbackSubcategoryId];
  return Array.from(new Set(ids));
}

/** Replace a product's subcategory links with `subcategoryIds` (deduped). */
export async function saveProductSubcategories(productId: string, subcategoryIds: string[]) {
  const ids = Array.from(new Set(subcategoryIds.filter(Boolean)));
  const { data, error } = await (supabase as any)
    .from("product_subcategories")
    .select("subcategory_id")
    .eq("product_id", productId);
  if (error) throw error;
  const existing = ((data ?? []) as { subcategory_id: string }[]).map((r) => r.subcategory_id);

  const toDelete = existing.filter((sid) => !ids.includes(sid));
  const toInsert = ids
    .filter((sid) => !existing.includes(sid))
    .map((sid) => ({ product_id: productId, subcategory_id: sid }));

  if (toDelete.length > 0) {
    const { error: dErr } = await (supabase as any)
      .from("product_subcategories")
      .delete()
      .eq("product_id", productId)
      .in("subcategory_id", toDelete);
    if (dErr) throw dErr;
  }
  if (toInsert.length > 0) {
    const { error: iErr } = await (supabase as any)
      .from("product_subcategories")
      .insert(toInsert);
    if (iErr) throw iErr;
  }
}

/** True when the category has at least one active subcategory (so it's required). */
export async function categoryHasSubcategories(categoryId: string): Promise<boolean> {
  const { count } = await (supabase as any)
    .from("subcategories")
    .select("id", { count: "exact", head: true })
    .eq("category_id", categoryId)
    .eq("is_active", true);
  return (count ?? 0) > 0;
}

/** True when ANY of the given categories has at least one active subcategory. */
export async function anyCategoryHasSubcategories(categoryIds: string[]): Promise<boolean> {
  const ids = Array.from(new Set(categoryIds.filter(Boolean)));
  if (ids.length === 0) return false;
  const { count } = await (supabase as any)
    .from("subcategories")
    .select("id", { count: "exact", head: true })
    .in("category_id", ids)
    .eq("is_active", true);
  return (count ?? 0) > 0;
}
