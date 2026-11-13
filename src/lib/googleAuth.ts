import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

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
