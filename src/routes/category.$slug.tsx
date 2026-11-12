import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import {
  CategoryFilterBody,
  CategoryFilterSheet,
} from "@/components/customer/CategoryFilterPanel";
import {
  activeFilterCount,
  emptyFilters,
  useCategoryFacets,
  useFilteredCategoryProducts,
  type CategoryFilterState,
} from "@/hooks/useCategoryFilters";
import { useCustomerCatalogRealtime } from "@/hooks/useCustomerProducts";
import { useCategorySubcategories } from "@/hooks/useSubcategories";
import { SubcategoryBar } from "@/components/customer/SubcategoryBar";
import { StorageImg } from "@/components/StorageImg";

export const Route = createFileRoute("/category/$slug")({
  head: ({ params }) => ({
    meta: [
      { title: `${params.slug} — AP Mart` },
      {
        name: "description",
        content: `Shop ${params.slug} online with lightning-fast delivery. Filter by brand, size, price and rating.`,
      },
      { property: "og:title", content: `${params.slug} — AP Mart` },
      {
        property: "og:description",
        content: `Shop ${params.slug} with lightning-fast delivery from AP Mart.`,
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: CategoryPage,
});

function CategoryPage() {
  const { slug } = Route.useParams();
  useCustomerCatalogRealtime();
  const qc = useQueryClient();

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
  const [subcategoryId, setSubcategoryId] = useState<string | null>(null);

  // Filters are per-category: reset whenever the category changes.
  useEffect(() => {
    setFilters(emptyFilters);
    setSubcategoryId(null);
  }, [categoryId]);

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

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <Link to="/" className="text-sm text-muted-foreground hover:underline">
        ← Home
      </Link>
      {category.data && (
        <div
          className="mt-4 rounded-3xl p-6 md:p-8 flex items-center gap-4 shadow-card"
          style={{ backgroundColor: (category.data.color ?? "#A3E635") + "33" }}
        >
          {category.data.image_url ? (
            <StorageImg
              src={category.data.image_url}
              alt={category.data.name}
              className="h-20 w-20 rounded-2xl object-cover"
              loading="lazy"
            />
          ) : (
            <div className="text-6xl">{category.data.icon}</div>
          )}
          <div>
            <h1 className="font-display text-3xl md:text-4xl font-extrabold">
              {category.data.name}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {facets.data?.total ?? 0} products available near you
            </p>
          </div>
        </div>
      )}

      <div className="mt-4">
        <SubcategoryBar
          subcategories={subcategories.data}
          loading={subcategories.isLoading}
          value={subcategoryId}
          onChange={setSubcategoryId}
          totalCount={facets.data?.total}
        />
      </div>


      {category.isError && !category.data && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-border bg-secondary/60 px-3 py-3 text-sm">
          <span className="text-muted-foreground">Couldn’t load this category.</span>
          <button onClick={() => category.refetch()} className="font-bold text-primary">
            Retry
          </button>
        </div>
      )}

      <div className="mt-6 grid md:grid-cols-[240px_1fr] gap-6">
        {/* Desktop filter rail */}
        <aside className="hidden md:block">
          <div className="flex items-center justify-between">
            <h3 className="font-display font-bold">Filters</h3>
            {active > 0 && (
              <button
                onClick={() => setFilters({ ...emptyFilters, sort: filters.sort })}
                className="text-xs font-bold text-primary"
              >
                Clear all
              </button>
            )}
          </div>
          <CategoryFilterBody {...panelProps} />
        </aside>

        <div>
          <div className="flex items-center justify-between gap-2 mb-4">
            <div className="md:hidden">
              <CategoryFilterSheet {...panelProps} />
            </div>
            <span className="hidden md:inline text-sm text-muted-foreground">
              {products.data?.length ?? 0} results
            </span>
            <select
              value={filters.sort}
              onChange={(e) =>
                setFilters({ ...filters, sort: e.target.value as CategoryFilterState["sort"] })
              }
              className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
            >
              <option value="relevance">Sort: Relevance</option>
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
              <option value="rating">Top rated</option>
            </select>
          </div>

          {products.isError && products.data ? (
            <div className="mb-3 flex items-center justify-between gap-2 rounded-xl border border-border bg-secondary/60 px-3 py-2 text-xs">
              <span className="text-muted-foreground">Couldn’t refresh products.</span>
              <button onClick={() => products.refetch()} className="font-bold text-primary">
                Retry
              </button>
            </div>
          ) : null}

          {!products.data ? (
            products.isError ? (
              <div className="text-center py-20">
                <p className="text-muted-foreground">Couldn’t load products.</p>
                <Button
                  variant="outline"
                  className="mt-4 rounded-xl font-bold"
                  onClick={() => products.refetch()}
                >
                  Try again
                </Button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
                ))}
              </div>
            )
          ) : products.data.length === 0 ? (
            <div className="text-center py-20">
              <div className="text-6xl">🔍</div>
              <p className="mt-3 text-muted-foreground">
                No products match these filters in this category.
              </p>
              {active > 0 && (
                <Button
                  variant="outline"
                  className="mt-4 rounded-xl font-bold"
                  onClick={() => setFilters({ ...emptyFilters, sort: filters.sort })}
                >
                  Clear all filters
                </Button>
              )}
            </div>
          ) : (
            <div
              className={`grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 transition-opacity ${
                products.isFetching ? "opacity-70" : "opacity-100"
              }`}
            >
              {products.data.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
