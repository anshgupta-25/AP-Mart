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

    // generateLink(magiclink) targets the REAL auth user for this email (creating it if
    // missing) and tells us whether it is confirmed: an indexed lookup in auth.users, with
    // no scan of all users and no trust in the user-editable profiles.email column.
    const link = () =>
      supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: identity.email,
        options: { data: meta },
      });
    let { data, error } = await link();
    if (error || !data?.user || !data.properties?.hashed_token) {
      console.error("[google-auth] generateLink failed:", error?.message);
      return fail(500, "Could not create your session. Please try again.");
    }

    // Pre-hijack defence: an UNCONFIRMED account with this email may have been registered by
    // someone else with a password they chose (or was just created above). Google has proven
    // ownership of the address, so replace any password and confirm the email. Updating the
    // user invalidates the token above, so issue a fresh one afterwards.
    if (!data.user.email_confirmed_at) {
      const { error: resetErr } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
        password: crypto.randomUUID() + crypto.randomUUID(),
        email_confirm: true,
      });
      if (resetErr) throw resetErr;
      ({ data, error } = await link());
      if (error || !data?.properties?.hashed_token) {
        console.error("[google-auth] generateLink (after confirm) failed:", error?.message);
        return fail(500, "Could not create your session. Please try again.");
      }
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
