import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { createClient, type User } from "@supabase/supabase-js";

// Deep link the Android app registers (AndroidManifest.xml). Must also be in
// Supabase > Authentication > URL Configuration > Redirect URLs.
export const NATIVE_AUTH_CALLBACK = "com.apmart.app://auth/callback";

let pkceClient: ReturnType<typeof createClient> | undefined;

/**
 * PKCE-mode auth client used only to start Google sign-in in the app. It shares
 * the main client's storage + storage key, so the code verifier it saves is
 * found by `supabase.auth.exchangeCodeForSession(code)` on /auth/callback.
 * PKCE means the deep link only carries a one-time code that is useless without
 * the verifier kept on this device (no tokens in a custom-scheme URL, and a
 * code minted elsewhere cannot be exchanged here).
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
 * Initiates Google OAuth using Supabase client.
 * Redirects to /auth/callback to handle session establishment and profile persistence.
 */
export async function signInWithGoogle(redirectPath = "/auth/callback"): Promise<{
  error: Error | null;
  redirected?: boolean;
}> {
  try {
    // Google blocks sign-in inside embedded WebViews ("disallowed_useragent"),
    // so the app opens it in the system browser and returns via deep link.
    if (Capacitor.isNativePlatform()) {
      const { data, error } = await nativePkceClient().auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: NATIVE_AUTH_CALLBACK,
          skipBrowserRedirect: true,
          queryParams: { prompt: "select_account" },
        },
      });
      if (error || !data?.url)
        return { error: error ?? new Error("No sign-in URL"), redirected: false };
      const { Browser } = await import("@capacitor/browser");
      // Wait until the browser closes (signed in via deep link, or the user
      // backed out) so the caller can stop its loading spinner.
      let onClosed!: () => void;
      const closed = new Promise<void>((resolve) => (onClosed = resolve));
      const handle = await Browser.addListener("browserFinished", () => onClosed());
      await Browser.open({ url: data.url });
      await closed;
      await handle.remove();
      return { error: null, redirected: false };
    }

    const normalizedPath = redirectPath.startsWith("/") ? redirectPath : `/${redirectPath}`;
    const redirectTo = `${window.location.origin}${normalizedPath}`;

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    if (error) {
      return { error, redirected: false };
    }

    return { error: null, redirected: true };
  } catch (err: any) {
    return {
      error:
        err instanceof Error
          ? err
          : new Error(String(err) || "Failed to initialize Google sign-in"),
      redirected: false,
    };
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
    const { data: existing, error: fetchError } = await (supabase as any)
      .from("profiles")
      .select("id, full_name, avatar_url, email")
      .eq("id", user.id)
      .maybeSingle();

    if (fetchError) {
      console.warn("[ProfileSync] Fetch warning:", fetchError.message);
    }

    if (existing) {
      const updates: Record<string, any> = {
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

      const { error: updateError } = await (supabase as any)
        .from("profiles")
        .update(updates)
        .eq("id", user.id);

      if (updateError) {
        console.warn("[ProfileSync] Update profile warning:", updateError.message);
        return { error: updateError };
      }
    } else {
      const { error: insertError } = await (supabase as any).from("profiles").insert({
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
  } catch (err: any) {
    console.error("[ProfileSync] Unexpected error syncing profile:", err);
    return {
      error: err instanceof Error ? err : new Error(String(err) || "Failed to sync profile"),
    };
  }
}
