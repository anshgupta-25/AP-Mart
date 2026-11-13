import type { Tables } from "@/integrations/supabase/types";

/**
 * The delivery address stored on an order (`orders.address`, a JSON column). It is a
 * snapshot of an `addresses` row taken at checkout, so every field is optional:
 * older orders may predate some columns.
 */
export type OrderAddress = Partial<Tables<"addresses">> & { full_name?: string | null };

/** Read an order's JSON address safely (returns `{}` for null / non-object values). */
export function asAddress(value: unknown): OrderAddress {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as OrderAddress) : {};
}
