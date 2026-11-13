import { Link } from "@tanstack/react-router";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";

export function ProductRail({
  title,
  subtitle,
  to = "/products",
  loading,
  products,
}: {
  title: string;
  emoji?: string;
  subtitle?: string;
  to?: string;
  loading?: boolean;
  products?: ProductCardData[];
}) {
  if (!loading && (!products || products.length === 0)) return null;
  return (
    <section className="cv-auto space-y-3">
      <div className="flex items-end justify-between gap-3 px-4">
        <div className="min-w-0">
          <h2 className="section-title truncate">{title}</h2>
          {subtitle && (
            <p className="mt-0.5 truncate text-small text-muted-foreground">{subtitle}</p>
          )}
        </div>
        <Link to={to} className="press shrink-0 text-meta font-semibold text-primary">
          See all
        </Link>
      </div>
      <div className="scrollbar-hide flex snap-x scroll-px-4 gap-2.5 overflow-x-auto px-4 pb-4">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-[200px] w-[128px] shrink-0 rounded-xl shimmer" />
            ))
          : products?.map((p) => (
              <div key={p.id} className="w-[128px] shrink-0 snap-start">
                <ProductCard product={p} />
              </div>
            ))}
      </div>
    </section>
  );
}
