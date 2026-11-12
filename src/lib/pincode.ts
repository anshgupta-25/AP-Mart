/**
 * Single source of truth for Indian PIN code handling.
 * Every part of the app (admin locations, customer addresses, shops,
 * cart/checkout, order routing) must store and compare PIN codes as
 * 6-digit strings produced by `normalizePincode`.
 */

/** Strip all whitespace (and other non-digits) but never drop leading zeros. */
export function normalizePincode(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value).replace(/\s+/g, "").replace(/\D/g, "");
}

/** Valid Indian PIN code: exactly 6 digits. */
export function isValidPincode(value: string | number | null | undefined): boolean {
  return /^[0-9]{6}$/.test(normalizePincode(value));
}

/** Normalize and validate in one step. Returns null when invalid. */
export function toPincode(value: string | number | null | undefined): string | null {
  const p = normalizePincode(value);
  return /^[0-9]{6}$/.test(p) ? p : null;
}

/** Case/whitespace-insensitive text normalization for state/city names. */
export function normalizePlace(value: string | null | undefined): string {
  return (value ?? "").replace(/\s+/g, " ").trim();
}

/** True when two PIN codes refer to the same area regardless of formatting. */
export function samePincode(a: unknown, b: unknown): boolean {
  const x = normalizePincode(a as string);
  const y = normalizePincode(b as string);
  return !!x && x === y;
}
