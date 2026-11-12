import { useEffect, useMemo, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useSubcategoriesForCategories } from "@/hooks/useSubcategories";
import { cn } from "@/lib/utils";

export interface SubcategoryCategoryOption {
  id: string;
  name: string;
}

/**
 * Multi-select subcategory picker driven by ALL selected main categories.
 * Options are grouped under their parent category, searchable, and the
 * popover stays open while ticking multiple items. Selections belonging to a
 * removed category are dropped automatically.
 */
export function SubcategorySelect({
  categoryIds,
  categories = [],
  value,
  onChange,
  required = false,
}: {
  categoryIds: string[];
  categories?: SubcategoryCategoryOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  required?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const { data = [], isLoading } = useSubcategoriesForCategories(categoryIds, true);

  const catName = useMemo(
    () => new Map(categories.map((c) => [c.id, c.name])),
    [categories],
  );

  // Drop picks whose parent category is no longer selected / no longer valid.
  useEffect(() => {
    if (value.length === 0) return;
    if (categoryIds.length === 0) { onChange([]); return; }
    if (isLoading || data.length === 0) return;
    const valid = value.filter((id) => data.some((s) => s.id === id));
    if (valid.length !== value.length) onChange(valid);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryIds.join(","), data, isLoading]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const byCat = new Map<string, typeof data>();
    for (const s of data) {
      if (q && !s.name.toLowerCase().includes(q)) continue;
      const arr = byCat.get(s.category_id) ?? [];
      arr.push(s);
      byCat.set(s.category_id, arr);
    }
    // Preserve the order the shopkeeper picked the categories in.
    return categoryIds
      .filter((cid) => (byCat.get(cid)?.length ?? 0) > 0)
      .map((cid) => ({ id: cid, name: catName.get(cid) ?? "Category", items: byCat.get(cid)! }));
  }, [data, query, categoryIds, catName]);

  const selected = data.filter((s) => value.includes(s.id));
  const toggle = (id: string) =>
    onChange(value.includes(id) ? value.filter((v) => v !== id) : [...value, id]);

  const noCats = categoryIds.length === 0;
  const noSubs = !noCats && !isLoading && data.length === 0;

  return (
    <div>
      <Label className="text-xs font-bold">
        Subcategories {required && <span className="text-destructive">*</span>}
      </Label>

      {selected.length > 0 && (
        <div className="mb-2 mt-1.5 flex flex-wrap gap-1.5">
          {selected.map((s) => (
            <span
              key={s.id}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold"
            >
              <span className="truncate">{s.name}</span>
              <button
                type="button"
                aria-label={`Remove ${s.name}`}
                onClick={() => onChange(value.filter((v) => v !== s.id))}
                className="shrink-0 rounded-full p-0.5 hover:bg-background/70"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild disabled={noCats || isLoading || noSubs}>
          <Button
            type="button"
            variant="outline"
            className={cn(
              "mt-1 h-10 w-full justify-between rounded-xl px-3 text-left font-normal",
              (noCats || noSubs) && "opacity-60",
            )}
          >
            <span className="truncate text-muted-foreground">
              {noCats ? "Select a category first" : "Select subcategories"}
            </span>
            <ChevronDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-[min(24rem,92vw)] p-0">
          <div className="flex items-center gap-2 border-b px-3 py-2">
            <Search className="h-4 w-4 shrink-0 opacity-50" />
            <Input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search subcategories..."
              className="h-8 border-0 px-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <div className="max-h-72 overflow-y-auto p-1">
            {groups.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                No subcategories found
              </p>
            ) : (
              groups.map((g) => (
                <div key={g.id} className="mb-1">
                  <p className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-foreground">
                    {g.name}
                  </p>
                  {g.items.map((s) => {
                    const on = value.includes(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggle(s.id)}
                        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent/40"
                      >
                        <Checkbox checked={on} className="pointer-events-none" />
                        <span className="flex-1 truncate">{s.name}</span>
                        {on && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    );
                  })}
                </div>
              ))
            )}
          </div>
          <div className="flex items-center justify-between border-t px-3 py-2 text-xs text-muted-foreground">
            <span>
              {value.length} subcategor{value.length === 1 ? "y" : "ies"} selected
            </span>
            {value.length > 0 && (
              <button type="button" className="font-semibold hover:underline" onClick={() => onChange([])}>
                Clear all
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>

      <p className="mt-1 text-[11px] text-muted-foreground">
        {noCats
          ? "Step 1: pick one or more categories above."
          : noSubs
            ? "No subcategories yet — the admin team manages these."
            : `${value.length} subcategor${value.length === 1 ? "y" : "ies"} selected — pick from any of your chosen categories.`}
      </p>
    </div>
  );
}
