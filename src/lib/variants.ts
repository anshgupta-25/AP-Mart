import { supabase } from "@/integrations/supabase/client";
import type { VariantDraft } from "@/components/VariantsEditor";

export type VariantRow = {
  id: string;
  product_id: string;
  name: string | null;
  size: string;
  unit: string | null;
  sku: string | null;
  barcode: string | null;
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

export async function loadVariants(productId: string): Promise<VariantRow[]> {
  const { data, error } = await (supabase as any)
    .from("product_variants")
    .select("*")
    .eq("product_id", productId)
    .order("display_order", { ascending: true });
  if (error) throw error;
  return (data ?? []) as VariantRow[];
}

export function rowToDraft(r: VariantRow): VariantDraft {
  return {
    id: r.id,
    name: r.name ?? "",
    size: r.size ?? "",
    unit: r.unit ?? "",
    sku: r.sku ?? "",
    barcode: r.barcode ?? "",
    weight: r.weight ?? "",
    mrp: Number(r.mrp) || 0,
    selling_price: Number(r.selling_price) || 0,
    retail_price: Number(r.retail_price) || 0,
    stock: Number(r.stock) || 0,
    images: Array.isArray(r.images) ? r.images : [],
    is_available: !!r.is_available,
    is_default: !!r.is_default,
    display_order: r.display_order ?? 0,
  };
}

export async function saveVariants(productId: string, drafts: VariantDraft[]) {
  const client = supabase as any;

  // Deletes
  const toDelete = drafts.filter((d) => d._deleted && d.id).map((d) => d.id!);
  if (toDelete.length) {
    const { error } = await client.from("product_variants").delete().in("id", toDelete);
    if (error) throw error;
  }

  // Validate + prepare
  const visible = drafts.filter((d) => !d._deleted);
  for (const v of visible) {
    if (!v.size.trim()) throw new Error("Every variant needs a Size");
    if (v.selling_price <= 0) throw new Error(`Variant "${v.size}" needs a selling price`);
    if (v.stock < 0) throw new Error(`Variant "${v.size}" has invalid stock`);
    if (v.images.length > 6) throw new Error(`Variant "${v.size}" has more than 6 images`);
  }

  // Ensure exactly one default (first available if none)
  if (visible.length > 0 && !visible.some((v) => v.is_default)) {
    visible[0].is_default = true;
  }

  const inserts = visible
    .filter((d) => !d.id)
    .map((d, i) => ({
      product_id: productId,
      name: d.name || null,
      size: d.size,
      unit: d.unit || null,
      sku: d.sku || null,
      barcode: d.barcode || null,
      weight: d.weight || null,
      mrp: d.mrp || 0,
      selling_price: d.selling_price,
      retail_price: d.retail_price || 0,
      stock: d.stock,
      images: d.images,
      is_available: d.is_available,
      is_default: d.is_default,
      display_order: d.display_order ?? i,
    }));

  if (inserts.length) {
    const { error } = await client.from("product_variants").insert(inserts);
    if (error) throw error;
  }

  // Batched bulk update: one upsert instead of one request per variant.
  const updates = visible
    .filter((d) => d.id)
    .map((d, i) => ({
      id: d.id!,
      product_id: productId,
      name: d.name || null,
      size: d.size,
      unit: d.unit || null,
      sku: d.sku || null,
      barcode: d.barcode || null,
      weight: d.weight || null,
      mrp: d.mrp || 0,
      selling_price: d.selling_price,
      retail_price: d.retail_price || 0,
      stock: d.stock,
      images: d.images,
      is_available: d.is_available,
      is_default: d.is_default,
      display_order: d.display_order ?? i,
    }));

  if (updates.length) {
    const { error } = await client.from("product_variants").upsert(updates, { onConflict: "id" });
    if (error) throw error;
  }
}

