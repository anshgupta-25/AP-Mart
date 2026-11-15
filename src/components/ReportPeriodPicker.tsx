import { useState } from "react";
import { CalendarDays, Check, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { endOfDay, isSameDay } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  MAX_RANGE_DAYS,
  PRESETS,
  customPeriod,
  periodDatesText,
  periodLabel,
  presetPeriod,
  type ReportPeriod,
} from "@/lib/reportPeriod";

/**
 * Period filter: quick presets (today, 2 days, 7 days, 30 days, 12 months) and a calendar to pick
 * any start and end date. Presets apply immediately; a calendar range is applied with "Apply".
 */
export function ReportPeriodPicker({
  value,
  onChange,
  className,
}: {
  value: ReportPeriod;
  onChange: (p: ReportPeriod) => void;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  // The calendar only pre-selects a custom range. For presets it starts empty on the current
  // month, so the first tap always starts a new range.
  const initialDraft = (): DateRange | undefined =>
    value.preset === "custom" ? { from: value.from, to: value.to } : undefined;
  const [draft, setDraft] = useState<DateRange | undefined>(initialDraft);

  const today = endOfDay(new Date());
  const draftPeriod = draft?.from ? customPeriod(draft.from, draft.to ?? draft.from) : null;

  return (
    <Popover
      open={open}
      onOpenChange={(o) => {
        setOpen(o);
        if (o) setDraft(initialDraft());
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Report period: ${periodLabel(value)}. Change`}
          className={cn(
            "press inline-flex h-9 max-w-full items-center gap-2 rounded-full border border-border/70 bg-card px-3.5 text-meta font-medium",
            className,
          )}
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate">{periodLabel(value)}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        data-slot="popover-content"
        align="start"
        collisionPadding={12}
        // Brand-coloured range (the global accent is yellow) and a layout that scrolls on short
        // screens while keeping the Apply row visible.
        style={
          {
            "--accent": "var(--primary-soft)",
            "--accent-foreground": "var(--primary-ink)",
          } as React.CSSProperties
        }
        className="flex max-h-[var(--radix-popover-content-available-height)] w-[min(22rem,calc(100vw-1.5rem))] flex-col p-0"
      >
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div className="space-y-2.5 p-3">
            <div className="text-caption font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Quick range
            </div>
            <div className="flex flex-wrap gap-2">
              {PRESETS.map((p) => {
                const on = value.preset === p.key;
                return (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      onChange(presetPeriod(p.key));
                      setOpen(false);
                    }}
                    className={cn(
                      "press inline-flex h-8 items-center gap-1 rounded-full px-3 text-small font-medium",
                      on
                        ? "bg-foreground text-background"
                        : "border border-border/70 bg-card hover:bg-secondary",
                    )}
                  >
                    {on && <Check className="h-3 w-3" />}
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-t border-border/60">
            <div className="px-3 pt-3 text-caption font-semibold uppercase tracking-[0.06em] text-muted-foreground">
              Or pick dates
            </div>
            <Calendar
              mode="range"
              selected={draft}
              onSelect={(range, day) => {
                // A multi-day range is already chosen: a new tap starts a fresh range instead of
                // stretching the old one. (A first tap is a one-day range, which the next tap extends.)
                if (draft?.from && draft.to && !isSameDay(draft.from, draft.to)) {
                  setDraft({ from: day, to: undefined });
                } else {
                  setDraft(range);
                }
              }}
              max={MAX_RANGE_DAYS}
              disabled={{ after: today }}
              defaultMonth={value.preset === "custom" ? value.from : new Date()}
              className="mx-auto"
            />
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-t border-border/60 bg-popover p-3">
          <div className="min-w-0 text-small text-muted-foreground">
            {draftPeriod ? (
              <span className="font-medium text-foreground">{periodDatesText(draftPeriod)}</span>
            ) : (
              "Tap a start and an end date"
            )}
            {draft?.from && (!draft.to || isSameDay(draft.from, draft.to)) && (
              <span className="block text-caption">
                Tap an end date for a range, or Apply for just this day.
              </span>
            )}
          </div>
          <Button
            size="sm"
            disabled={!draftPeriod}
            onClick={() => {
              if (!draftPeriod) return;
              onChange(draftPeriod);
              setOpen(false);
            }}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
