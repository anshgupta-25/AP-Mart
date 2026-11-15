import { createRemoteJWKSet, jwtVerify } from "jose";

// Google's public signing keys (cached + rotated automatically by jose).
const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"];

export type GoogleIdentity = {
  sub: string;
  email: string;
  name: string;
  picture: string;
};

/**
 * Verifies a Google Identity Services ID token: RS256 signature against
 * Google's published keys, issuer, audience (our client ID) and expiry.
 * Throws on any failure. Needs only the public client ID — no secret.
 */
export async function verifyGoogleIdToken(
  idToken: string,
  audience: string,
): Promise<GoogleIdentity> {
  const { payload } = await jwtVerify(idToken, GOOGLE_JWKS, {
    issuer: GOOGLE_ISSUERS,
    audience,
    algorithms: ["RS256"],
    clockTolerance: 5,
  });
  const email = typeof payload.email === "string" ? payload.email.toLowerCase() : "";
  if (!payload.sub || !email) throw new Error("Token has no subject or email");
  if (payload.email_verified !== true) throw new Error("Google email is not verified");
  return {
    sub: payload.sub,
    email,
    name: typeof payload.name === "string" ? payload.name : "",
    picture: typeof payload.picture === "string" ? payload.picture : "",
  };
}
