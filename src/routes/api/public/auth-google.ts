import { createFileRoute } from "@tanstack/react-router";
import { corsHeadersFor } from "@/lib/api-base";
import { verifyGoogleIdToken } from "@/lib/googleIdToken.server";

/**
 * Google Sign-In (Google Identity Services). The browser posts the ID token
 * (`credential`); we verify it against Google's public keys, find or create the
 * matching user, and return a one-time token hash. The client redeems it with
 * `supabase.auth.verifyOtp` to start the normal application session.
 * Supabase's own Google OAuth provider is NOT used.
 */
async function handle(request: Request): Promise<Response> {
  const cors = corsHeadersFor(request.headers.get("origin")) ?? {};
  const fail = (status: number, error: string) =>
    Response.json({ error }, { status, headers: cors });

  const clientId = process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID;
  if (!clientId) return fail(500, "Google sign-in is not configured on the server.");

  let credential = "";
  try {
    const body = (await request.json()) as { credential?: unknown };
    credential = typeof body.credential === "string" ? body.credential : "";
  } catch {
    return fail(400, "Invalid request.");
  }
  if (!credential) return fail(400, "Missing credential.");

  let identity;
  try {
    identity = await verifyGoogleIdToken(credential, clientId);
  } catch (err) {
    console.warn("[google-auth] token rejected:", err instanceof Error ? err.message : err);
    return fail(401, "Google sign-in could not be verified. Please try again.");
  }

  try {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = {
      full_name: identity.name,
      name: identity.name,
      avatar_url: identity.picture,
      picture: identity.picture,
      provider: "google",
      google_sub: identity.sub,
    };

    // Pre-hijack defence: an UNCONFIRMED account with this email may have been
    // registered by someone else with a password they chose. Google has just
    // proven ownership of the address, so replace that password before the
    // account is confirmed by the magic link below.
    for (let page = 1; page <= 10; page++) {
      const { data: list, error: listErr } = await supabaseAdmin.auth.admin.listUsers({
        page,
        perPage: 1000,
      });
      if (listErr) throw listErr;
      const existing = list.users.find((u) => (u.email ?? "").toLowerCase() === identity.email);
      if (existing) {
        if (!existing.email_confirmed_at) {
          const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(existing.id, {
            password: crypto.randomUUID() + crypto.randomUUID(),
            email_confirm: true,
          });
          if (resetErr) throw resetErr;
        }
        break;
      }
      if (list.users.length < 1000) break;
    }

    // generateLink(magiclink) creates the user if missing and returns a token we can redeem.
    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: identity.email,
      options: { data: meta },
    });
    if (error || !data?.properties?.hashed_token) {
      console.error("[google-auth] generateLink failed:", error?.message);
      return fail(500, "Could not create your session. Please try again.");
    }
    return Response.json({ token_hash: data.properties.hashed_token }, { headers: cors });
  } catch (err) {
    console.error("[google-auth] unexpected:", err);
    return fail(500, "Could not create your session. Please try again.");
  }
}

export const Route = createFileRoute("/api/public/auth-google")({
  server: {
    handlers: {
      POST: async ({ request }) => handle(request),
      OPTIONS: async ({ request }) => {
        const cors = corsHeadersFor(request.headers.get("origin"));
        return new Response(null, { status: cors ? 204 : 403, headers: cors ?? {} });
      },
    },
  },
});
