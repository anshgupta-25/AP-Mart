import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Plus, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export interface CategoryOption {
  id: string;
  name: string;
}

export interface MultiCategorySelectProps {
  options: CategoryOption[];
  value: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  disabled?: boolean;
  id?: string;
  placeholder?: string;
  className?: string;
}

/**
 * Searchable multi-select for product categories.
 * Selected categories render as removable chips; the trigger opens a
 * searchable list to add more (capped at `max`, default 5).
 */
export function MultiCategorySelect({
  options,
  value,
  onChange,
  max = 5,
  disabled,
  id,
  placeholder = "Add more categories",
  className,
}: MultiCategorySelectProps) {
  const [open, setOpen] = useState(false);
  const byId = useMemo(() => new Map(options.map((o) => [o.id, o])), [options]);
  const selected = value.filter((v) => byId.has(v));
  const atMax = selected.length >= max;

  function toggle(catId: string) {
    if (value.includes(catId)) {
      onChange(value.filter((v) => v !== catId));
      return;
    }
    if (atMax) return;
    onChange([...value, catId]);
  }

  return (
    <div className={cn("space-y-2", className)}>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((cid) => (
            <span
              key={cid}
              className="inline-flex max-w-full items-center gap-1 rounded-full bg-secondary px-2.5 py-1 text-xs font-semibold"
            >
              <span className="truncate">{byId.get(cid)?.name}</span>
              <button
                type="button"
                aria-label={`Remove ${byId.get(cid)?.name}`}
                disabled={disabled}
                onClick={() => onChange(value.filter((v) => v !== cid))}
                className="shrink-0 rounded-full p-0.5 hover:bg-background/70"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            id={id}
            disabled={disabled}
            className="h-10 w-full justify-between rounded-xl font-normal"
          >
            <span className="flex items-center gap-1.5 truncate text-muted-foreground">
              <Plus className="h-3.5 w-3.5" />
              {placeholder}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
          <Command>
            <div className="flex items-center border-b px-3">
              <Search className="mr-2 h-4 w-4 opacity-50" />
              <CommandInput placeholder="Search categories..." className="h-10 border-0 focus:ring-0" />
            </div>
            <CommandList>
              <CommandEmpty>No categories found</CommandEmpty>
              <CommandGroup>
                {options.map((o) => {
                  const isSel = value.includes(o.id);
                  return (
                    <CommandItem
                      key={o.id}
                      value={o.name}
                      disabled={!isSel && atMax}
                      onSelect={() => toggle(o.id)}
                    >
                      <Check className={cn("mr-2 h-4 w-4", isSel ? "opacity-100" : "opacity-0")} />
                      {o.name}
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <p className="text-[11px] text-muted-foreground">
        {selected.length}/{max} selected{atMax ? " — remove one to add another" : ""}
      </p>
    </div>
  );
}
