import { useMemo } from "react";
import { SlidersHorizontal, X } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { rupees } from "@/lib/format";
import {
  activeFilterCount,
  emptyFilters,
  type CategoryFacets,
  type CategoryFilterState,
} from "@/hooks/useCategoryFilters";

interface Props {
  facets?: CategoryFacets;
  loading?: boolean;
  filters: CategoryFilterState;
  onChange: (next: CategoryFilterState) => void;
  resultCount?: number;
}

function toggle<T>(list: T[], v: T): T[] {
  return list.includes(v) ? list.filter((x) => x !== v) : [...list, v];
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-4 border-b border-border last:border-0">
      <h4 className="text-[13px] font-extrabold uppercase tracking-wide text-muted-foreground mb-3">
        {title}
      </h4>
      {children}
    </div>
  );
}

function CheckRow({
  label,
  count,
  checked,
  onToggle,
}: {
  label: string;
  count: number;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className="flex items-center gap-2.5 py-1.5 cursor-pointer select-none">
      <Checkbox checked={checked} onCheckedChange={onToggle} />
      <span className="text-sm flex-1 truncate">{label}</span>
      <span className="text-[11px] text-muted-foreground">({count})</span>
    </label>
  );
}

/** Body of the filter panel — every option comes from the current category's live data. */
export function CategoryFilterBody({ facets, loading, filters, onChange }: Props) {
  const f = facets;
  const priceMin = f?.min_price ?? 0;
  const priceMax = f?.max_price ?? 0;
  const range = useMemo<[number, number]>(
    () => [filters.minPrice ?? priceMin, filters.maxPrice ?? priceMax],
    [filters.minPrice, filters.maxPrice, priceMin, priceMax],
  );

  if (loading) {
    return (
      <div className="space-y-3 py-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-9 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!f || f.total === 0) {
    return (
      <p className="py-6 text-sm text-muted-foreground">
        No products in this category yet, so there is nothing to filter.
      </p>
    );
  }

  return (
    <div className="divide-y divide-border">
      {f.brands.length > 0 && (
        <Section title="Brand">
          {f.brands.map((b) => (
            <CheckRow
              key={b.label}
              label={b.label}
              count={b.count}
              checked={filters.brands.includes(b.label)}
              onToggle={() => onChange({ ...filters, brands: toggle(filters.brands, b.label) })}
            />
          ))}
        </Section>
      )}

      {priceMax > priceMin && (
        <Section title="Price range">
          <div className="px-1">
            <Slider
              min={priceMin}
              max={priceMax}
              step={1}
              value={range}
              onValueChange={(v) =>
                onChange({ ...filters, minPrice: v[0] ?? null, maxPrice: v[1] ?? null })
              }
            />
            <div className="mt-2 flex justify-between text-xs font-semibold">
              <span>{rupees(range[0])}</span>
              <span>{rupees(range[1])}</span>
            </div>
          </div>
        </Section>
      )}

      {f.sizes.length > 0 && (
        <Section title="Size / Quantity">
          {f.sizes.map((s) => (
            <CheckRow
              key={s.label}
              label={s.label}
              count={s.count}
              checked={filters.sizes.includes(s.label)}
              onToggle={() => onChange({ ...filters, sizes: toggle(filters.sizes, s.label) })}
            />
          ))}
        </Section>
      )}

      {f.subcategories.length > 0 && (
        <Section title="Subcategory">
          {f.subcategories.map((s) => (
            <CheckRow
              key={s.id}
              label={s.label}
              count={s.count}
              checked={filters.subcategories.includes(s.id)}
              onToggle={() =>
                onChange({ ...filters, subcategories: toggle(filters.subcategories, s.id) })
              }
            />
          ))}
        </Section>
      )}

      {f.discounts.length > 0 && (
        <Section title="Discount">
          {f.discounts.map((d) => (
            <CheckRow
              key={d.value}
              label={`${d.value}% & above`}
              count={d.count}
              checked={filters.minDiscount === d.value}
              onToggle={() =>
                onChange({ ...filters, minDiscount: filters.minDiscount === d.value ? null : d.value })
              }
            />
          ))}
        </Section>
      )}

      {f.delivery.length > 0 && (
        <Section title="Delivery speed">
          {f.delivery.map((d) => (
            <CheckRow
              key={d.value}
              label={d.label}
              count={d.count}
              checked={filters.delivery.includes(d.value)}
              onToggle={() => onChange({ ...filters, delivery: toggle(filters.delivery, d.value) })}
            />
          ))}
        </Section>
      )}

      {f.ratings.length > 0 && (
        <Section title="Rating">
          {f.ratings.map((r) => (
            <CheckRow
              key={r.value}
              label={`${r.value}★ & above`}
              count={r.count}
              checked={filters.minRating === r.value}
              onToggle={() =>
                onChange({ ...filters, minRating: filters.minRating === r.value ? null : r.value })
              }
            />
          ))}
        </Section>
      )}

    </div>
  );
}

/** Mobile trigger + sheet wrapper. */
export function CategoryFilterSheet(props: Props) {
  const count = activeFilterCount(props.filters);
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" className="h-10 rounded-xl gap-2 font-bold">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {count > 0 && (
            <span className="ml-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-primary px-1 text-[11px] font-extrabold text-primary-foreground">
              {count}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl">
        <SheetHeader className="text-left">
          <SheetTitle className="font-display">Filters</SheetTitle>
        </SheetHeader>
        <CategoryFilterBody {...props} />
        <div className="sticky bottom-0 -mx-6 mt-2 flex gap-3 border-t border-border bg-background px-6 py-3">
          <Button
            variant="outline"
            className="flex-1 rounded-xl font-bold"
            onClick={() => props.onChange({ ...emptyFilters, sort: props.filters.sort })}
          >
            <X className="h-4 w-4 mr-1" /> Clear all
          </Button>
          <span className="flex-1 grid place-items-center text-sm font-semibold text-muted-foreground">
            {props.resultCount ?? 0} products
          </span>
        </div>
      </SheetContent>
    </Sheet>
  );
}
