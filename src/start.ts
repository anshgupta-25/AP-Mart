import { createStart, createMiddleware } from "@tanstack/react-start";

import { renderErrorPage } from "./lib/error-page";
import { attachSupabaseAuth } from "./integrations/supabase/auth-attacher";
import { corsHeadersFor, toApiUrl } from "./lib/api-base";

// Lets the Android app (served from https://localhost) call this server.
// Only the native app origins are allowed; browsers on the website are same-origin.
const corsMiddleware = createMiddleware().server(async ({ request, next }) => {
  const cors = corsHeadersFor(request.headers.get("origin"));
  if (!cors) return next();
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  let result: Awaited<ReturnType<typeof next>>;
  try {
    result = await next();
  } catch (error) {
    // Errors rethrown by errorMiddleware (HTTP errors with a statusCode) would
    // otherwise reach the app without CORS headers and surface as "Failed to fetch".
    const e = error as { statusCode?: number; status?: number; message?: string };
    const status = e?.statusCode ?? e?.status ?? 500;
    return new Response(JSON.stringify({ error: e?.message ?? "Request failed" }), {
      status,
      headers: { ...cors, "content-type": "application/json" },
    });
  }
  // Copy into a fresh Response: headers on some responses are immutable.
  const res = result.response;
  const headers = new Headers(res.headers);
  for (const [k, v] of Object.entries(cors)) headers.set(k, v);
  return {
    ...result,
    response: new Response(res.body, { status: res.status, statusText: res.statusText, headers }),
  };
});

const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error(error);
    return new Response(renderErrorPage(), {
      status: 500,
      headers: { "content-type": "text/html; charset=utf-8" },
    });
  }
});

export const startInstance = createStart(() => ({
  requestMiddleware: [corsMiddleware, errorMiddleware],
  functionMiddleware: [attachSupabaseAuth],
  // In the mobile build, send server-function calls to the hosted server.
  serverFns: { fetch: (input, init) => fetch(toApiUrl(input), init) },
}));
