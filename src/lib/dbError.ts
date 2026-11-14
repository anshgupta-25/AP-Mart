/**
 * Turn an opaque PostgREST / Storage error into a readable, debuggable message.
 * Includes the operation, error code, hint/details and the failed payload,
 * and logs the raw error to the console for deeper inspection.
 */
type ErrorLike =
  { message?: unknown; code?: unknown; details?: unknown; hint?: unknown } | null | undefined;

export function describeError(err: unknown, operation: string, payload?: unknown): Error {
  const error = (typeof err === "object" ? err : { message: err }) as ErrorLike;
  // eslint-disable-next-line no-console
  console.error(`[${operation}] failed`, { error: err, payload });

  const parts: string[] = [];
  const raw = String(error?.message ?? "Unknown error");

  if (/row-level security/i.test(raw)) {
    parts.push(`Permission denied on ${operation}: your account is not allowed to write this row.`);
  } else {
    parts.push(`${operation}: ${raw}`);
  }
  if (error?.code) parts.push(`code ${error.code}`);
  if (error?.details) parts.push(String(error.details));
  if (error?.hint) parts.push(`hint: ${error.hint}`);
  if (payload) {
    try {
      parts.push(`payload: ${JSON.stringify(payload)}`);
    } catch {
      /* ignore */
    }
  }
  return new Error(parts.join(" · "));
}
