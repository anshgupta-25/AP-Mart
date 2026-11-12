import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Reports whether the signed-in user may delete their own account, and why not.
 * Always scoped to auth.uid() inside the database function.
 */
export const checkAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("account_deletion_check");
    if (error) throw new Error(error.message);
    return (data ?? { allowed: false, reason: "Unable to verify account" }) as {
      allowed: boolean;
      reason?: string;
      roles?: string[];
      active_count?: number;
    };
  });

/**
 * Permanently deletes the CALLER's account. The user id comes from the verified
 * bearer token — never from request data — so nobody can delete another account.
 * Master catalog products and required business records are preserved by the
 * database routine; only after it succeeds is the auth user removed.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const check = await context.supabase.rpc("account_deletion_check");
    if (check.error) throw new Error(check.error.message);
    const verdict = check.data as { allowed: boolean; reason?: string } | null;
    if (!verdict?.allowed) throw new Error(verdict?.reason ?? "Account cannot be deleted");

    const purge = await context.supabase.rpc("delete_my_account_data");
    if (purge.error) throw new Error(purge.error.message);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(context.userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
