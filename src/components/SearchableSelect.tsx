import { useState } from "react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
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

export interface SearchableSelectProps {
  value: string | null;
  onChange: (value: string) => void;
  options: string[];
  placeholder?: string;
  emptyText?: string;
  disabled?: boolean;
  id?: string;
  className?: string;
}

export function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "Select...",
  emptyText = "No options found",
  disabled,
  id,
  className,
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          id={id}
          disabled={disabled}
          className={cn(
            "w-full h-11 rounded-xl mt-1 justify-between font-normal",
            !value && "text-muted-foreground",
            className,
          )}
        >
          <span className="truncate">{value ?? placeholder}</span>
          <ChevronsUpDown className="h-4 w-4 opacity-50 shrink-0 ml-2" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="p-0 w-[--radix-popover-trigger-width]"
        align="start"
      >
        <Command>
          <div className="flex items-center border-b px-3">
            <Search className="h-4 w-4 opacity-50 mr-2" />
            <CommandInput placeholder="Search..." className="h-10 border-0 focus:ring-0" />
          </div>
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((opt) => (
                <CommandItem
                  key={opt}
                  value={opt}
                  onSelect={() => {
                    onChange(opt);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === opt ? "opacity-100" : "opacity-0",
                    )}
                  />
                  {opt}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
