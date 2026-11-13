import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { ArrowLeft, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CategoryFilterBody, CategoryFilterSheet } from "@/components/customer/CategoryFilterPanel";
import {
  activeFilterCount,
  emptyFilters,
  useCategoryFacets,
  useFilteredCategoryProducts,
  type CategoryFilterState,
} from "@/hooks/useCategoryFilters";
import { useCustomerCatalogRealtime } from "@/hooks/useCustomerProducts";
import { useCategorySubcategories } from "@/hooks/useSubcategories";
import { useHeaderOffset } from "@/hooks/useHeaderOffset";
import { SubcategoryBar } from "@/components/customer/SubcategoryBar";

const searchSchema = z.object({ sub: z.string().optional() });

export const Route = createFileRoute("/category/$slug")({
  validateSearch: searchSchema,
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — AP Mart` },
      {
        name: "description",
        content: `Shop ${params.slug} from trusted local shops near you. Filter by brand, size, price and rating.`,
      },
      { property: "og:title", content: `${params.slug} — AP Mart` },
      {
        property: "og:description",
        content: `Shop ${params.slug} from local shops on AP Mart.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CategoryPage,
});

const BAR_H = 48;
const BOTTOM_NAV_H = 64;

function CategoryPage() {
  const { slug } = Route.useParams();
  const { sub } = Route.useSearch();
  useCustomerCatalogRealtime();
  const qc = useQueryClient();
  const headerH = useHeaderOffset();

  const category = useQuery({
    queryKey: ["category", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, slug, name, icon, color, image_url")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    // The category list is usually cached already (browse page): seed from it so the product
    // query starts immediately instead of waiting for a slug -> id round trip.
    placeholderData: () => {
      const list = qc.getQueryData<any[]>(["cats-browse"]);
      const hit = list?.find((c) => c.slug === slug);
      return hit
        ? {
            id: hit.id,
            slug: hit.slug,
            name: hit.name,
            icon: hit.icon,
            color: hit.color,
            image_url: hit.image_url,
          }
        : undefined;
    },
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  const categoryId = category.data?.id ?? null;
  const [filters, setFilters] = useState<CategoryFilterState>(emptyFilters);
  const [subcategoryId, setSubcategoryId] = useState<string | null>(sub ?? null);

  // Filters are per-category: reset whenever the category (or a deep-linked subcategory) changes.
  useEffect(() => {
    setFilters(emptyFilters);
    setSubcategoryId(sub ?? null);
  }, [categoryId, sub]);

  const subcategories = useCategorySubcategories(categoryId);
  const facets = useCategoryFacets(categoryId);
  const products = useFilteredCategoryProducts(categoryId, filters, { limit: 60, subcategoryId });
  const active = activeFilterCount(filters);

  const panelProps = {
    facets: facets.data,
    loading: facets.isLoading,
    filters,
    onChange: setFilters,
    resultCount: products.data?.length ?? 0,
  };

  const hasRail = (subcategories.data?.length ?? 0) > 0 || subcategories.isLoading;
  const railTop = headerH + BAR_H;
  const gridCols = hasRail
    ? "grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-4"
    : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5";

  return (
    <div className="mx-auto max-w-6xl">
      <div style={{ top: headerH }} className="hairline-b sticky z-30 bg-tint-mint">
        <div className="flex items-center gap-2 px-3" style={{ height: BAR_H }}>
          <Link
            to="/"
            aria-label="Back to home"
            className="press grid h-8 w-8 place-items-center rounded-full bg-card"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <h1 className="min-w-0 flex-1 truncate text-subtitle font-semibold">
            {category.data?.name ?? "Category"}
          </h1>
          <Link
            to="/products"
            search={{ cat: slug }}
            aria-label="Search products"
            className="press grid h-8 w-8 place-items-center rounded-full bg-card"
          >
            <Search className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {category.isError && !category.data && (
        <div className="m-3 flex items-center justify-between rounded-xl bg-secondary px-3.5 py-3 text-meta">
          <span className="text-muted-foreground">Couldn’t load this category.</span>
          <button onClick={() => category.refetch()} className="font-semibold text-primary">
            Retry
          </button>
        </div>
      )}

      <div className="flex items-start">
        {hasRail && (
          <aside
            style={{
              top: railTop,
              maxHeight: `calc(100dvh - ${railTop}px - ${BOTTOM_NAV_H}px)`,
            }}
            className="scrollbar-hide sticky w-[78px] shrink-0 self-start overflow-y-auto border-r border-border/60 bg-card"
          >
            <SubcategoryBar
              subcategories={subcategories.data}
              loading={subcategories.isLoading}
              value={subcategoryId}
              onChange={setSubcategoryId}
              fallbackIcon={category.data?.icon}
            />
          </aside>
        )}

        <div className="min-w-0 flex-1 px-2.5 pb-24 pt-2.5 md:grid md:grid-cols-[200px_1fr] md:gap-5 md:px-4 md:pb-10">
          <aside className="hidden md:block">
            <div className="flex items-center justify-between">
              <h3 className="section-title">Filters</h3>
              {active > 0 && (
                <button
                  onClick={() => setFilters({ ...emptyFilters, sort: filters.sort })}
                  className="text-small font-semibold text-primary"
                >
                  Clear all
                </button>
              )}
            </div>
            <CategoryFilterBody {...panelProps} />
          </aside>

          <div className="min-w-0">
            <div className="mb-2.5 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="md:hidden">
                  <CategoryFilterSheet {...panelProps} />
                </div>
                <span className="text-small text-muted-foreground">
                  {products.data ? `${products.data.length} items` : ""}
                </span>
              </div>
              <select
                value={filters.sort}
                onChange={(e) =>
                  setFilters({ ...filters, sort: e.target.value as CategoryFilterState["sort"] })
                }
                aria-label="Sort products"
                className="h-8 rounded-full border border-border/70 bg-card px-3 text-small font-medium outline-none"
              >
                <option value="relevance">Relevance</option>
                <option value="price_asc">Price: Low to High</option>
                <option value="price_desc">Price: High to Low</option>
                <option value="rating">Top rated</option>
              </select>
            </div>

            {products.isError && products.data ? (
              <div className="mb-3 flex items-center justify-between gap-2 rounded-xl bg-secondary px-3.5 py-2.5 text-small">
                <span className="text-muted-foreground">Couldn’t refresh products.</span>
                <button onClick={() => products.refetch()} className="font-semibold text-primary">
                  Retry
                </button>
              </div>
            ) : null}

            {!products.data ? (
              products.isError ? (
                <div className="py-16 text-center">
                  <p className="text-meta text-muted-foreground">Couldn’t load products.</p>
                  <Button variant="secondary" className="mt-3" onClick={() => products.refetch()}>
                    Try again
                  </Button>
                </div>
              ) : (
                <div className={`grid gap-2.5 ${gridCols}`}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Skeleton key={i} className="h-[210px] rounded-xl" />
                  ))}
                </div>
              )
            ) : products.data.length === 0 ? (
              <div className="rounded-xl border border-border/70 bg-card px-5 py-12 text-center">
                <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-tint-mint">
                  <Search className="h-5 w-5 text-primary" />
                </div>
                <p className="section-title mt-3">Nothing here yet</p>
                <p className="mt-1 text-meta text-muted-foreground">
                  No products match these filters in this category.
                </p>
                {active > 0 && (
                  <Button
                    variant="secondary"
                    className="mt-4"
                    onClick={() => setFilters({ ...emptyFilters, sort: filters.sort })}
                  >
                    Clear all filters
                  </Button>
                )}
              </div>
            ) : (
              <div
                className={`grid gap-2.5 transition-opacity ${gridCols} ${
                  products.isFetching ? "opacity-70" : "opacity-100"
                }`}
              >
                {products.data.map((p) => (
                  <div key={p.id} className="pb-3">
                    <ProductCard product={p} />
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
