export const PARTNER_STATUS_VALUES = [
  "available",
  "assigned",
  "going_to_shop",
  "picked_up",
  "out_for_delivery",
  "reached_area",
  "delivered",
  "offline",
] as const;

export type PartnerStatus = (typeof PARTNER_STATUS_VALUES)[number];

const META: Record<string, { label: string; cls: string }> = {
  available:        { label: "Available",          cls: "bg-green-500/15 text-green-700 dark:text-green-400" },
  assigned:         { label: "Assigned",           cls: "bg-blue-500/15 text-blue-700 dark:text-blue-400" },
  going_to_shop:    { label: "Going to shop",      cls: "bg-indigo-500/15 text-indigo-700 dark:text-indigo-400" },
  picked_up:        { label: "Picked up",          cls: "bg-purple-500/15 text-purple-700 dark:text-purple-400" },
  out_for_delivery: { label: "Out for delivery",   cls: "bg-amber-500/15 text-amber-700 dark:text-amber-400" },
  reached_area:     { label: "Reached area",       cls: "bg-orange-500/15 text-orange-700 dark:text-orange-400" },
  delivered:        { label: "Delivered",          cls: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400" },
  offline:          { label: "Offline",            cls: "bg-muted text-muted-foreground" },
  busy:             { label: "Busy",               cls: "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400" },
};

export function partnerStatusMeta(status?: string | null, fallbackOnline?: boolean) {
  if (status && META[status]) return META[status];
  if (fallbackOnline === false) return META.offline;
  if (fallbackOnline === true) return META.available;
  return { label: status ?? "—", cls: "bg-muted text-muted-foreground" };
}

export function timeAgo(iso?: string | null) {
  if (!iso) return "—";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "—";
  const s = Math.max(0, Math.floor((Date.now() - t) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}
