import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useDeliveryContext } from "./useDeliveryContext";
import type { ProductCardData } from "@/components/ProductCard";

export interface CustomerProductsArgs {
  categoryId?: string | null;
  search?: string | null;
  onlyFeatured?: boolean;
  onlyBestseller?: boolean;
  sort?: "relevance" | "price_asc" | "price_desc" | "rating";
  limit?: number;
  ids?: string[] | null;
  enabled?: boolean;
  key?: string; // extra cache key discriminator
}

/**
 * Fetches products currently available from at least one active shop
 * in the customer's PIN code. Uses list_customer_products RPC so removed
 * or unavailable inventory disappears automatically.
 */
export function useCustomerProducts(args: CustomerProductsArgs = {}) {
  const {
    categoryId = null,
    search = null,
    onlyFeatured = false,
    onlyBestseller = false,
    sort = "relevance",
    limit = 60,
    ids = null,
    enabled = true,
    key,
  } = args;

  const { pincode, ready } = useDeliveryContext();
  // Sorted + joined so a caller re-creating the array each render can't change the key.
  const idsKey = ids === null ? null : [...ids].sort().join(",");

  return useQuery({
    queryKey: [
      "customer-products",
      pincode,
      categoryId,
      search,
      onlyFeatured,
      onlyBestseller,
      sort,
      limit,
      idsKey,
      key,
    ],
    // Wait until the delivery context is resolved: firing with pincode=null and
    // then again with the real pincode was what blanked the grid on first paint.
    enabled: enabled && ready && (ids === null || ids.length > 0),
    staleTime: 60_000,
    // Keep the previous page of products on screen while a new key loads.
    placeholderData: (prev) => prev,
    queryFn: async (): Promise<ProductCardData[]> => {
      const { data, error } = await (supabase as any).rpc(
        "list_customer_products",
        {
          _pincode: pincode,
          _category_id: categoryId,
          _search: search,
          _only_featured: onlyFeatured,
          _only_bestseller: onlyBestseller,
          _sort: sort,
          _limit: limit,
          _ids: ids,
        },
      );
      if (error) throw error;
      return (data ?? []) as ProductCardData[];
    },
  });
}

/**
 * Subscribe to shop_products / products / shops changes and invalidate
 * customer catalog queries so the UI updates without a manual refresh.
 *
 * The channel is ref-counted at module level: several mounted components
 * (shell + category page) previously each opened a channel, so one inventory
 * change fired the same invalidation multiple times. Invalidations are also
 * debounced, and only refetch queries that are actually rendered.
 */
let channelRefs = 0;
let channel: ReturnType<typeof supabase.channel> | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function useCustomerCatalogRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const invalidate = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        debounceTimer = null;
        qc.invalidateQueries({ queryKey: ["customer-products"], refetchType: "active" });
        qc.invalidateQueries({ queryKey: ["category-products"], refetchType: "active" });
        qc.invalidateQueries({ queryKey: ["cat-product-counts"], refetchType: "active" });
      }, 800);
    };

    channelRefs += 1;
    if (!channel) {
      channel = supabase
        .channel("customer-catalog")
        .on("postgres_changes", { event: "*", schema: "public", table: "shop_products" }, invalidate)
        .on("postgres_changes", { event: "*", schema: "public", table: "products" }, invalidate)
        .on("postgres_changes", { event: "*", schema: "public", table: "shops" }, invalidate)
        .subscribe();
    }

    return () => {
      channelRefs -= 1;
      if (channelRefs <= 0) {
        channelRefs = 0;
        if (debounceTimer) {
          clearTimeout(debounceTimer);
          debounceTimer = null;
        }
        if (channel) {
          supabase.removeChannel(channel);
          channel = null;
        }
      }
    };
  }, [qc]);
}
