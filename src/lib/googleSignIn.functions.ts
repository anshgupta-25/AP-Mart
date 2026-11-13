import { createServerFn } from "@tanstack/react-start";

/**
 * Direct Google Identity Services sign-in (no Supabase OAuth provider).
 *
 * The browser gets a Google ID token (JWT) from Google's official GIS library and
 * posts it here. This function:
 *   1. verifies the signature against Google's published keys (JWKS),
 *   2. verifies issuer, audience (our OAuth client ID), expiry and nonce,
 *   3. requires a Google-verified email,
 *   4. refuses deactivated accounts,
 *   5. mints an ordinary application session for that user.
 * Only the public client ID is used. No OAuth client secret is needed or exposed.
 */

const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const GOOGLE_JWKS_URL = "https://www.googleapis.com/oauth2/v3/certs";

type Input = { credential: string; nonce: string };

function validate(raw: unknown): Input {
  const d = raw as Partial<Input> | null;
  if (
    !d ||
    typeof d.credential !== "string" ||
    d.credential.length < 20 ||
    d.credential.length > 8192 ||
    typeof d.nonce !== "string" ||
    d.nonce.length < 16 ||
    d.nonce.length > 256
  ) {
    throw new Error("Invalid sign-in request.");
  }
  return { credential: d.credential, nonce: d.nonce };
}

let jwks: ReturnType<typeof import("jose").createRemoteJWKSet> | undefined;

export const signInWithGoogleCredential = createServerFn({ method: "POST" })
  .inputValidator(validate)
  .handler(async ({ data }) => {
    const clientId = (process.env.GOOGLE_CLIENT_ID || process.env.VITE_GOOGLE_CLIENT_ID || "").trim();
    if (!clientId) throw new Error("Google sign-in is not configured on the server.");

    const { createRemoteJWKSet, jwtVerify } = await import("jose");
    jwks ??= createRemoteJWKSet(new URL(GOOGLE_JWKS_URL));

    let payload;
    try {
      ({ payload } = await jwtVerify(data.credential, jwks, {
        issuer: GOOGLE_ISSUERS,
        audience: clientId,
        algorithms: ["RS256"],
        clockTolerance: 5,
      }));
    } catch (err) {
      console.warn("[GoogleSignIn] token rejected:", (err as Error).message);
      throw new Error("Google sign-in could not be verified. Please try again.");
    }

    if (payload.nonce !== data.nonce) throw new Error("Google sign-in could not be verified.");
    const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
    if (!email || payload.email_verified !== true) {
      throw new Error("Your Google account email is not verified.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const meta = {
      full_name: typeof payload.name === "string" ? payload.name : "",
      name: typeof payload.name === "string" ? payload.name : "",
      given_name: typeof payload.given_name === "string" ? payload.given_name : "",
      family_name: typeof payload.family_name === "string" ? payload.family_name : "",
      avatar_url: typeof payload.picture === "string" ? payload.picture : "",
      picture: typeof payload.picture === "string" ? payload.picture : "",
      google_sub: payload.sub,
    };

    // Resolves the existing account by email (keeping its profile and roles) or
    // creates it (the handle_new_user trigger then adds profile + customer role).
    // Admin API: never touches /auth/v1/authorize or the Google provider.
    const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
      options: { data: meta },
    });
    const userId = link?.user?.id;
    const tokenHash = link?.properties?.hashed_token;
    if (linkError || !userId || !tokenHash) {
      console.error("[GoogleSignIn] generateLink failed:", linkError?.message);
      throw new Error("Could not start your session. Please try again.");
    }

    const { data: profile } = await (supabaseAdmin as any)
      .from("profiles")
      .select("status, is_active")
      .eq("id", userId)
      .maybeSingle();
    if (
      profile?.is_active === false ||
      profile?.status === "disabled" ||
      profile?.status === "suspended"
    ) {
      throw new Error("Your account has been deactivated. Please contact support.");
    }

    // Exchange the one-time hash for a session on a throwaway, non-persisting client.
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const anon = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    if (!url || !anon) throw new Error("Server is missing Supabase configuration.");
    const anonClient = createClient(url, anon, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });
    const { data: verified, error: verifyError } = await anonClient.auth.verifyOtp({
      type: "magiclink",
      token_hash: tokenHash,
    });
    const s = verified?.session;
    if (verifyError || !s) {
      console.error("[GoogleSignIn] verifyOtp failed:", verifyError?.message);
      throw new Error("Could not start your session. Please try again.");
    }
    return { access_token: s.access_token, refresh_token: s.refresh_token };
  });
