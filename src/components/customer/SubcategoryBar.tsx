import { cn } from "@/lib/utils";
import type { SubcategoryWithCount } from "@/hooks/useSubcategories";

/**
 * Blinkit-style sticky horizontal subcategory filter bar.
 * "All" is always first and is the default selection.
 */
export function SubcategoryBar({
  subcategories,
  value,
  onChange,
  loading,
  totalCount,
  showCounts = true,
}: {
  subcategories?: SubcategoryWithCount[];
  value: string | null;
  onChange: (id: string | null) => void;
  loading?: boolean;
  totalCount?: number;
  showCounts?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex gap-2 overflow-hidden py-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-9 w-24 shrink-0 rounded-full shimmer" />
        ))}
      </div>
    );
  }

  const items = subcategories ?? [];
  if (items.length === 0) return null;

  const chip = (active: boolean) =>
    cn(
      "shrink-0 whitespace-nowrap rounded-full border px-4 py-2 text-xs font-bold transition",
      active
        ? "border-foreground bg-foreground text-background"
        : "border-border bg-card text-foreground hover:bg-secondary",
    );

  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-border bg-background/90 px-4 py-2 backdrop-blur">
      <div
        className="flex gap-2 overflow-x-auto scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label="Subcategories"
      >
        <button
          type="button"
          role="tab"
          aria-selected={value === null}
          onClick={() => onChange(null)}
          className={chip(value === null)}
        >
          All{showCounts && typeof totalCount === "number" ? ` (${totalCount})` : ""}
        </button>
        {items.map((s) => (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={value === s.id}
            onClick={() => onChange(s.id)}
            className={chip(value === s.id)}
          >
            {s.name}
            {showCounts ? ` (${s.product_count})` : ""}
          </button>
        ))}
      </div>
    </div>
  );
}
