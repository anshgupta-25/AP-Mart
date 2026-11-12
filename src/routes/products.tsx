import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/useAuth";
import { useCustomerProducts } from "@/hooks/useCustomerProducts";

const search = z.object({ q: z.string().optional(), cat: z.string().optional() });

export const Route = createFileRoute("/products")({
  validateSearch: search,
  head: () => ({ meta: [{ title: "All products — AP Mart" }] }),
  component: ProductsPage,
});

function ProductsPage() {
  const { q, cat } = Route.useSearch();
  const [sort, setSort] = useState<"relevance" | "price-asc" | "price-desc" | "rating">("relevance");
  const { user, loading, roles } = useAuth() as any;
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || !user) return;
    const allowed = roles?.length === 0 || roles?.includes("customer") || roles?.includes("admin");
    if (!allowed) {
      if (roles?.includes("shopkeeper")) navigate({ to: "/shopkeeper/dashboard" });
      else if (roles?.includes("delivery")) navigate({ to: "/delivery/dashboard" });
      else navigate({ to: "/dashboard" });
    }
  }, [loading, user, roles, navigate]);

  const categories = useQuery({
    queryKey: ["categories"],
    queryFn: async () =>
      (await supabase.from("categories").select("id, slug, name, icon, color, display_order").eq("is_active", true).order("display_order")).data ?? [],
    staleTime: 10 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });


  const catRow = categories.data?.find((c: any) => c.slug === cat) ?? null;
  const sortKey =
    sort === "price-asc" ? "price_asc"
    : sort === "price-desc" ? "price_desc"
    : sort === "rating" ? "rating"
    : "relevance";
  const products = useCustomerProducts({
    categoryId: catRow?.id ?? null,
    search: q ?? null,
    sort: sortKey,
    limit: 60,
    key: `list:${q ?? ""}:${cat ?? ""}:${sort}`,
  });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 grid md:grid-cols-[220px_1fr] gap-6">
      <aside className="hidden md:block">
        <h3 className="font-display font-bold mb-3">Categories</h3>
        <div className="space-y-1">
          <Link
            to="/products"
            search={{}}
            className={`block rounded-xl px-3 py-2 text-sm hover:bg-secondary ${!cat ? "bg-primary/15 font-bold" : ""}`}
          >
            All
          </Link>
          {categories.data?.map((c) => (
            <Link
              key={c.id}
              to="/products"
              search={{ cat: c.slug } as any}
              className={`block rounded-xl px-3 py-2 text-sm hover:bg-secondary ${cat === c.slug ? "bg-primary/15 font-bold" : ""}`}
            >
              <span className="mr-2">{c.icon}</span>{c.name}
            </Link>
          ))}
        </div>
      </aside>

      <div>
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h1 className="font-display text-2xl md:text-3xl font-bold">
            {q ? `Search: "${q}"` : cat ? categories.data?.find((c) => c.slug === cat)?.name : "All products"}
          </h1>
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as any)}
            className="rounded-xl border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="relevance">Sort: Relevance</option>
            <option value="price-asc">Price: Low to High</option>
            <option value="price-desc">Price: High to Low</option>
            <option value="rating">Top rated</option>
          </select>
        </div>

        {!products.data ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {Array.from({ length: 12 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)}
          </div>
        ) : products.data.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-6xl">🛒</div>
            <p className="mt-3 text-muted-foreground">No products match your search.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {products.data?.map((p) => <ProductCard key={p.id} product={p} />)}
          </div>
        )}
      </div>
    </div>
  );
}
