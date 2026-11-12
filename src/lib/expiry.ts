export type ExpiryStatus = "none" | "fresh" | "near_expiry" | "expired";

export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function daysUntil(dateStr: string | null | undefined): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return null;
  return daysBetween(new Date(), d);
}

export function shelfLifeDays(
  mfg: string | null | undefined,
  exp: string | null | undefined,
): number | null {
  if (!mfg || !exp) return null;
  const m = new Date(mfg);
  const e = new Date(exp);
  if (isNaN(m.getTime()) || isNaN(e.getTime())) return null;
  return daysBetween(m, e);
}

/**
 * Human "days remaining" label:
 *   Expires Today / Expires in N Days / Expired N Days Ago
 */
export function daysRemainingLabel(days: number | null): string {
  if (days === null) return "";
  if (days === 0) return "Expires Today";
  if (days > 0) return `Expires in ${days} Day${days === 1 ? "" : "s"}`;
  const n = Math.abs(days);
  return `Expired ${n} Day${n === 1 ? "" : "s"} Ago`;
}

/**
 * Product status by 30% shelf-life rule when mfg is known.
 * Falls back to a 7-day window when only expiry is set.
 */
export function expiryStatus(
  exp: string | null | undefined,
  mfg?: string | null | undefined,
): {
  status: ExpiryStatus;
  days: number | null;
  label: string;      // days-remaining label ("Expires in 5 Days", "Expired 2 Days Ago")
  statusLabel: string; // Fresh / Near Expiry / Expired
  color: string;
  emoji: string;
} {
  const days = daysUntil(exp);
  if (days === null) {
    return { status: "none", days: null, label: "", statusLabel: "", color: "", emoji: "" };
  }
  const label = daysRemainingLabel(days);

  if (days < 0) {
    return {
      status: "expired",
      days,
      label,
      statusLabel: "Expired",
      color: "bg-red-100 text-red-700 border-red-300",
      emoji: "🔴",
    };
  }

  // Determine near-expiry threshold
  const shelf = shelfLifeDays(mfg ?? null, exp);
  const nearExpiry =
    shelf && shelf > 0 ? days / shelf <= 0.3 : days <= 7;

  if (nearExpiry) {
    return {
      status: "near_expiry",
      days,
      label,
      statusLabel: "Near Expiry",
      color: "bg-yellow-100 text-yellow-800 border-yellow-300",
      emoji: "🟡",
    };
  }

  return {
    status: "fresh",
    days,
    label,
    statusLabel: "Fresh",
    color: "bg-green-100 text-green-700 border-green-300",
    emoji: "🟢",
  };
}
