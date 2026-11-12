import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDeliveryContext } from "./useDeliveryContext";

export interface Subcategory {
  id: string;
  category_id: string;
  name: string;
  slug: string;
  image_url: string | null;
  icon: string | null;
  display_order: number;
  is_active: boolean;
  is_featured: boolean;
}

export interface SubcategoryWithCount {
  id: string;
  name: string;
  slug: string;
  image_url: string | null;
  icon: string | null;
  display_order: number;
  product_count: number;
}

/**
 * Customer-facing subcategory bar data: active subcategories of a category
 * plus the number of products actually deliverable to the shopper's pincode.
 */
export function useCategorySubcategories(categoryId?: string | null) {
  const { pincode, ready } = useDeliveryContext();
  return useQuery({
    queryKey: ["category-subcategories", pincode, categoryId],
    enabled: ready && !!categoryId,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<SubcategoryWithCount[]> => {
      const { data, error } = await (supabase as any).rpc("list_category_subcategories", {
        _category_id: categoryId,
        _pincode: pincode,
      });
      if (error) throw error;
      return (data ?? []) as SubcategoryWithCount[];
    },
  });
}

/** All subcategories of one category (admin editing + shopkeeper product form). */
export function useSubcategories(categoryId?: string | null, activeOnly = false) {
  return useQuery({
    queryKey: ["subcategories", categoryId, activeOnly],
    enabled: !!categoryId,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Subcategory[]> => {
      let q = (supabase as any)
        .from("subcategories")
        .select("id, category_id, name, slug, image_url, icon, display_order, is_active, is_featured")
        .eq("category_id", categoryId)
        .order("display_order")
        .order("name");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Subcategory[];
    },
  });
}

export function slugifySubcategory(s: string) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

/** All active subcategories across several categories (multi-category product form). */
export function useSubcategoriesForCategories(categoryIds: string[], activeOnly = true) {
  const ids = Array.from(new Set(categoryIds.filter(Boolean))).sort();
  return useQuery({
    queryKey: ["subcategories-multi", ids, activeOnly],
    enabled: ids.length > 0,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<Subcategory[]> => {
      let q = (supabase as any)
        .from("subcategories")
        .select("id, category_id, name, slug, image_url, icon, display_order, is_active, is_featured")
        .in("category_id", ids)
        .order("display_order")
        .order("name");
      if (activeOnly) q = q.eq("is_active", true);
      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as Subcategory[];
    },
  });
}
