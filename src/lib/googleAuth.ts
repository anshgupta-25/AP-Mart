import { supabase } from "@/integrations/supabase/client";
import { createClient, type User } from "@supabase/supabase-js";
import { toApiUrl } from "@/lib/api-base";
import type { TablesUpdate } from "@/integrations/supabase/types";

// Deep link the Android app registers (AndroidManifest.xml). Must also be in
// Supabase > Authentication > URL Configuration > Redirect URLs.
export const NATIVE_AUTH_CALLBACK = "com.apmart.app://auth/callback";

let pkceClient: ReturnType<typeof createClient> | undefined;

/**
 * PKCE-mode auth client used only to start Google sign-in in the Android app. It shares
 * the main client's storage + storage key, so the code verifier it saves is found by
 * `supabase.auth.exchangeCodeForSession(code)` on /auth/callback. The deep link only
 * carries a one-time code that is useless without the verifier kept on this device.
 */
function nativePkceClient() {
  pkceClient ??= createClient(
    import.meta.env.VITE_SUPABASE_URL as string,
    import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string,
    {
      auth: {
        flowType: "pkce",
        storage: localStorage,
        persistSession: true,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    },
  );
  return pkceClient;
}

/**
 * Google sign-in for the Android app (Capacitor). Google blocks sign-in inside WebViews
 * and the GIS button is unreliable there, so this opens Supabase's Google OAuth in the
 * system browser; it returns via com.apmart.app://auth/callback?code=… (handled in
 * __root.tsx), and /auth/callback exchanges the code. Requires the Google provider to be
 * enabled in Supabase. Resolves once the browser closes (signed in, or backed out).
 */
export async function signInWithGoogleNative(): Promise<{ error: Error | null }> {
  try {
    const { data, error } = await nativePkceClient().auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: NATIVE_AUTH_CALLBACK,
        skipBrowserRedirect: true,
        queryParams: { prompt: "select_account" },
      },
    });
    if (error || !data?.url) return { error: error ?? new Error("No sign-in URL") };
    const { Browser } = await import("@capacitor/browser");
    let onClosed!: () => void;
    const closed = new Promise<void>((resolve) => (onClosed = resolve));
    const handle = await Browser.addListener("browserFinished", () => onClosed());
    await Browser.open({ url: data.url });
    await closed;
    await handle.remove();
    return { error: null };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error("Google sign-in failed") };
  }
}

/**
 * Exchanges a Google Identity Services ID token for an application session.
 * The server verifies the token (signature, issuer, audience, expiry) and
 * returns a one-time token hash, which Supabase redeems into a normal session.
 * Supabase's Google OAuth provider is not involved.
 */
export async function signInWithGoogleCredential(credential: string): Promise<{
  error: Error | null;
}> {
  try {
    const res = await fetch(toApiUrl("/api/public/auth-google"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ credential }),
    });
    const body = (await res.json().catch(() => ({}))) as { token_hash?: string; error?: string };
    if (!res.ok || !body.token_hash) {
      return { error: new Error(body.error || "Google sign-in failed") };
    }
    // "email" redeems both cases: generateLink(magiclink) issues a "signup" token for a
    // brand-new user and a "magiclink" token for an existing one. Verifying as
    // "magiclink" rejects the new-user token, so a first Google sign-in would fail.
    const { error } = await supabase.auth.verifyOtp({
      token_hash: body.token_hash,
      type: "email",
    });
    return { error };
  } catch (err) {
    return { error: err instanceof Error ? err : new Error("Google sign-in failed") };
  }
}

/**
 * Idempotently saves/updates authenticated user's profile in public.profiles.
 * Saves user's UUID, name, avatar URL, email, and timestamps preserving RLS.
 */
export async function syncUserProfile(user: User): Promise<{ error: Error | null }> {
  if (!user) return { error: null };

  try {
    const meta = user.user_metadata || {};
    const fullName =
      meta.full_name ||
      meta.name ||
      meta.user_name ||
      [meta.given_name, meta.family_name].filter(Boolean).join(" ") ||
      "";
    const avatarUrl = meta.avatar_url || meta.picture || "";
    const email = user.email || meta.email || "";
    const now = new Date().toISOString();

    // Check if profile exists for this authenticated user
    const { data: existing, error: fetchError } = await supabase
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .eq("id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.warn("[ProfileSync] Fetch warning:", fetchError.message);
    }

    if (existing) {
      const updates: TablesUpdate<"profiles"> = {
        updated_at: now,
      };

      if ((!existing.full_name || existing.full_name.trim() === "") && fullName) {
        updates.full_name = fullName;
      }
      if ((!existing.avatar_url || existing.avatar_url.trim() === "") && avatarUrl) {
        updates.avatar_url = avatarUrl;
      }
      if ((!existing.email || existing.email.trim() === "") && email) {
        updates.email = email;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (updateError) {
        console.warn("[ProfileSync] Update profile warning:", updateError.message);
        return { error: updateError };
      }
    } else {
      const { error: insertError } = await supabase.from("profiles").insert({
        id: user.id,
        full_name: fullName,
        avatar_url: avatarUrl || null,
        email: email || null,
        created_at: now,
        updated_at: now,
      });

      if (insertError) {
        console.warn("[ProfileSync] Insert profile warning:", insertError.message);
        return { error: insertError };
      }
    }

    return { error: null };
  } catch (err) {
    console.error("[ProfileSync] Unexpected error syncing profile:", err);
    return {
      error: err instanceof Error ? err : new Error(String(err) || "Failed to sync profile"),
    };
  }
}
