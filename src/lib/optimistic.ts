import type { QueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

/**
 * Small helpers for optimistic UI: patch the react-query cache immediately,
 * then roll back automatically if the backend call fails.
 * These never change business logic — the server stays the source of truth
 * (we always invalidate on success).
 */

type Updater = (prev: unknown) => unknown;

/** Apply an updater to every cached query matching the given key prefixes. Returns a rollback fn. */
export function optimisticPatch(qc: QueryClient, keys: readonly unknown[][], updater: Updater): () => void {
  const snapshots: Array<[readonly unknown[], unknown]> = [];
  for (const key of keys) {
    for (const [k, data] of qc.getQueriesData({ queryKey: key as any })) {
      snapshots.push([k, data]);
      qc.setQueryData(k, (prev: unknown) => updater(prev));
    }
  }
  return () => {
    for (const [k, data] of snapshots) qc.setQueryData(k, data);
  };
}

/** Patch a row (matched by `id`) inside cached arrays. */
export const patchRow =
  (id: string, patch: Record<string, unknown>): Updater =>
  (prev) =>
    Array.isArray(prev) ? prev.map((r: any) => (r && r.id === id ? { ...r, ...patch } : r)) : prev;

/** Remove a row (matched by any of the given id fields) from cached arrays. */
export const removeRow =
  (id: string, fields: string[] = ["id"]): Updater =>
  (prev) =>
    Array.isArray(prev) ? prev.filter((r: any) => !r || !fields.some((f) => r[f] === id)) : prev;

/** Shallow-merge a patch into a cached object (e.g. a single order detail). */
export const patchObject =
  (patch: Record<string, unknown>): Updater =>
  (prev) =>
    prev && typeof prev === "object" && !Array.isArray(prev) ? { ...(prev as object), ...patch } : prev;

/** Patch a nested object under `order` (shape used by useOrderDetails). */
export const patchOrderDetail =
  (patch: Record<string, unknown>): Updater =>
  (prev) => {
    const p = prev as any;
    if (!p || typeof p !== "object" || !p.order) return prev;
    return { ...p, order: { ...p.order, ...patch } };
  };

export interface OptimisticRunOptions {
  qc: QueryClient;
  /** Cache key prefixes to patch + invalidate. */
  keys: readonly unknown[][];
  updater: Updater;
  request: () => PromiseLike<{ error: { message: string } | null }>;
  success?: string;
  onSuccess?: () => void;
}

/**
 * Patch the UI instantly, run the request in the background, roll back on failure.
 */
export async function runOptimistic({
  qc,
  keys,
  updater,
  request,
  success,
  onSuccess,
}: OptimisticRunOptions): Promise<boolean> {
  const rollback = optimisticPatch(qc, keys, updater);
  const { error } = await request();
  if (error) {
    rollback();
    toast.error(error.message);
    return false;
  }
  if (success) toast.success(success);
  for (const key of keys) qc.invalidateQueries({ queryKey: key as any });
  onSuccess?.();
  return true;
}
