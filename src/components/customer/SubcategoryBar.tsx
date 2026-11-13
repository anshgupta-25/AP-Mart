import { cn } from "@/lib/utils";
import type { SubcategoryWithCount } from "@/hooks/useSubcategories";
import { ProductImage } from "@/components/ProductImage";

/**
 * Vertical subcategory rail (Blinkit-style). "All" is always first and the default.
 */
export function SubcategoryBar({
  subcategories,
  value,
  onChange,
  loading,
  fallbackIcon,
}: {
  subcategories?: SubcategoryWithCount[];
  value: string | null;
  onChange: (id: string | null) => void;
  loading?: boolean;
  totalCount?: number;
  showCounts?: boolean;
  fallbackIcon?: string | null;
}) {
  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="mx-auto h-[68px] w-14 rounded-xl shimmer" />
        ))}
      </div>
    );
  }

  const items = subcategories ?? [];
  if (items.length === 0) return null;

  const item = (active: boolean, key: string, label: string, onClick: () => void, icon: React.ReactNode) => (
    <button
      key={key}
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={cn(
        "relative flex w-full flex-col items-center gap-1 px-1 py-2.5 text-center transition-colors",
        active ? "bg-primary-soft" : "hover:bg-secondary/60",
      )}
    >
      {active && <span className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" />}
      <span
        className={cn(
          "grid h-11 w-11 place-items-center overflow-hidden rounded-full text-page",
          active ? "bg-card" : "bg-tint-mint",
        )}
      >
        {icon}
      </span>
      <span
        className={cn(
          "line-clamp-2 w-full break-words text-micro leading-[13px]",
          active ? "font-semibold text-primary-ink" : "font-medium text-foreground/80",
        )}
      >
        {label}
      </span>
    </button>
  );

  return (
    <div role="tablist" aria-label="Subcategories" className="flex flex-col">
      {item(value === null, "all", "All", () => onChange(null), <span>{fallbackIcon ?? "🛍️"}</span>)}
      {items.map((s) =>
        item(
          value === s.id,
          s.id,
          s.name,
          () => onChange(s.id),
          s.image_url ? (
            <ProductImage src={s.image_url} alt={s.name} fit="contain" className="h-full w-full bg-transparent p-1" />
          ) : (
            <span>{s.icon ?? fallbackIcon ?? "🛍️"}</span>
          ),
        ),
      )}
    </div>
  );
}
