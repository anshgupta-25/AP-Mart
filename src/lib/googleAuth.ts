import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";
import { toApiUrl } from "@/lib/api-base";
import type { TablesUpdate } from "@/integrations/supabase/types";

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
