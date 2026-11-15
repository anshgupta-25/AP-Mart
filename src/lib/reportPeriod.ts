import { differenceInCalendarDays, endOfDay, format, startOfDay, subDays } from "date-fns";

/**
 * The period a report covers. `from` is the start of the first day and `to` the end of the last
 * day (both in the user's local time), so day boundaries are what the user expects.
 */
export type PeriodPreset = "today" | "2d" | "7d" | "30d" | "365d" | "custom";
export type ReportPeriod = { preset: PeriodPreset; from: Date; to: Date };

export const PRESETS: { key: Exclude<PeriodPreset, "custom">; label: string; days: number }[] = [
  { key: "today", label: "Today", days: 1 },
  { key: "2d", label: "Last 2 days", days: 2 },
  { key: "7d", label: "Last 7 days", days: 7 },
  { key: "30d", label: "Last 30 days", days: 30 },
  { key: "365d", label: "Last 12 months", days: 365 },
];

/** Longest custom range the picker allows (the orders query is capped, so keep it sensible). */
export const MAX_RANGE_DAYS = 366;

/** A preset period ending today (including today). */
export function presetPeriod(key: Exclude<PeriodPreset, "custom">, now = new Date()): ReportPeriod {
  const days = PRESETS.find((p) => p.key === key)!.days;
  return { preset: key, from: startOfDay(subDays(now, days - 1)), to: endOfDay(now) };
}

/** A custom period between two calendar days (inclusive). A single picked day is one day. */
export function customPeriod(from: Date, to: Date = from): ReportPeriod {
  const [a, b] = from <= to ? [from, to] : [to, from];
  return { preset: "custom", from: startOfDay(a), to: endOfDay(b) };
}

export const DEFAULT_PERIOD_KEY = "7d" as const;

/** Number of calendar days the period covers (inclusive). */
export const periodDays = (p: ReportPeriod) => differenceInCalendarDays(p.to, p.from) + 1;

/** Human label: "Last 7 days", "14 Nov 2026" or "12 Nov – 14 Nov 2026". */
export function periodLabel(p: ReportPeriod): string {
  if (p.preset !== "custom") return PRESETS.find((x) => x.key === p.preset)!.label;
  const sameDay = differenceInCalendarDays(p.to, p.from) === 0;
  if (sameDay) return format(p.from, "d MMM yyyy");
  const sameYear = p.from.getFullYear() === p.to.getFullYear();
  return `${format(p.from, sameYear ? "d MMM" : "d MMM yyyy")} – ${format(p.to, "d MMM yyyy")}`;
}

/** Always-explicit text for documents: "12 Nov 2026 – 14 Nov 2026" (even for presets). */
export function periodDatesText(p: ReportPeriod): string {
  return differenceInCalendarDays(p.to, p.from) === 0
    ? format(p.from, "d MMM yyyy")
    : `${format(p.from, "d MMM yyyy")} – ${format(p.to, "d MMM yyyy")}`;
}
