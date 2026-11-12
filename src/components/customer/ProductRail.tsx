import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { ProductCard, type ProductCardData } from "@/components/ProductCard";

export function ProductRail({
  title,
  emoji,
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
  return (
    <section className="space-y-3">
      <div className="px-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-[17px] font-extrabold leading-tight flex items-center gap-1.5">
            {emoji && <span className="text-xl">{emoji}</span>}
            <span className="truncate">{title}</span>
          </h2>
          {subtitle && <p className="text-[11px] text-muted-foreground truncate">{subtitle}</p>}
        </div>
        <Link
          to={to as any}
          className="shrink-0 inline-flex items-center gap-0.5 text-[12px] font-bold text-primary"
        >
          See all <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
      <div className="flex gap-3 overflow-x-auto scrollbar-hide -mx-1 px-4 pb-1 snap-x">
        {loading
          ? Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="w-[150px] shrink-0 aspect-[3/4] rounded-2xl shimmer" />
            ))
          : products?.map((p) => (
              <div key={p.id} className="w-[150px] shrink-0 snap-start">
                <ProductCard product={p} />
              </div>
            ))}
      </div>
    </section>
  );
}
