import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useDeliveryContext } from "./useDeliveryContext";
import type { ProductCardData } from "@/components/ProductCard";

export interface FacetOption {
  label: string;
  count: number;
}
export interface SubcategoryOption extends FacetOption {
  id: string;
}
export interface NumericOption {
  value: number;
  count: number;
}

export interface DeliveryOption extends FacetOption {
  value: string;
}

export interface CategoryFacets {
  total: number;
  min_price: number;
  max_price: number;
  brands: FacetOption[];
  sizes: FacetOption[];
  subcategories: SubcategoryOption[];
  ratings: NumericOption[];
  discounts: NumericOption[];
  delivery: DeliveryOption[];
}

const EMPTY: CategoryFacets = {
  total: 0,
  min_price: 0,
  max_price: 0,
  brands: [],
  sizes: [],
  subcategories: [],
  ratings: [],
  discounts: [],
  delivery: [],
};


/** Live filter options derived from the products available in this category + pincode. */
export function useCategoryFacets(categoryId?: string | null, enabled = true) {
  const { pincode, ready } = useDeliveryContext();
  return useQuery({
    queryKey: ["category-facets", pincode, categoryId],
    enabled: enabled && ready && !!categoryId,
    staleTime: 5 * 60 * 1000,
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<CategoryFacets> => {
      const { data, error } = await (supabase as any).rpc("category_filter_facets", {
        _pincode: pincode,
        _category_id: categoryId,
      });
      if (error) throw error;
      return { ...EMPTY, ...((data ?? {}) as Partial<CategoryFacets>) };
    },
  });
}

export interface CategoryFilterState {
  brands: string[];
  sizes: string[];
  subcategories: string[];
  delivery: string[];
  minPrice: number | null;
  maxPrice: number | null;
  minRating: number | null;
  minDiscount: number | null;
  sort: "relevance" | "price_asc" | "price_desc" | "rating";
}

export const emptyFilters: CategoryFilterState = {
  brands: [],
  sizes: [],
  subcategories: [],
  delivery: [],
  minPrice: null,
  maxPrice: null,
  minRating: null,
  minDiscount: null,
  sort: "relevance",
};

export function activeFilterCount(f: CategoryFilterState) {
  return (
    f.brands.length +
    f.sizes.length +
    f.subcategories.length +
    f.delivery.length +
    (f.minPrice !== null || f.maxPrice !== null ? 1 : 0) +
    (f.minRating !== null ? 1 : 0) +
    (f.minDiscount !== null ? 1 : 0)
  );
}


export interface FilteredProduct extends ProductCardData {
  brand: string | null;
}

/** Products in a category matching ALL selected filters. */
export function useFilteredCategoryProducts(
  categoryId: string | null | undefined,
  filters: CategoryFilterState,
  opts: { limit?: number; enabled?: boolean; subcategoryId?: string | null } = {},
) {
  const { pincode, ready } = useDeliveryContext();
  const { limit = 60, enabled = true, subcategoryId = null } = opts;
  return useQuery({
    queryKey: ["category-products", pincode, categoryId, subcategoryId, filters, limit],
    enabled: enabled && ready && !!categoryId,
    staleTime: 60_000,
    // Switching category / subcategory / filters keeps the current grid on
    // screen until the new result set arrives — no blank flash.
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<FilteredProduct[]> => {
      const { data, error } = await (supabase as any).rpc("list_category_products", {
        _pincode: pincode,
        _category_id: categoryId,
        _search: null,
        _brands: filters.brands.length ? filters.brands : null,
        _sizes: filters.sizes.length ? filters.sizes : null,
        _subcategory_ids: filters.subcategories.length ? filters.subcategories : null,
        _subcategory_id: subcategoryId,
        _delivery: filters.delivery.length ? filters.delivery : null,

        _min_price: filters.minPrice,
        _max_price: filters.maxPrice,
        _min_rating: filters.minRating,
        _min_discount: filters.minDiscount,
        _sort: filters.sort,
        _limit: limit,
      });
      if (error) throw error;
      return (data ?? []) as FilteredProduct[];
    },
  });
}

