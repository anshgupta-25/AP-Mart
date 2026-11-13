import type { Database } from "./types";

type Fns = Database["public"]["Functions"];

/**
 * Typed RPC arguments that may be `null`.
 *
 * Optional SQL parameters are declared `DEFAULT NULL`, so passing `null` is valid at
 * runtime, but the generated types only allow `undefined` for them. This keeps every
 * argument name and value type checked against the generated function signature while
 * allowing `null`. The payload sent to PostgREST is unchanged.
 */
export function rpcArgs<F extends keyof Fns>(
  _fn: F,
  args: { [K in keyof Fns[F]["Args"]]: Fns[F]["Args"][K] | null },
): Fns[F]["Args"] {
  return args as unknown as Fns[F]["Args"];
}
