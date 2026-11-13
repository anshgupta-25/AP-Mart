/**
 * Creates the single platform Super Admin account from server-side
 * environment variables (SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD).
 *
 * Idempotent and scoped to the configured address: it only ever grants
 * super_admin to SUPER_ADMIN_EMAIL, so the endpoint cannot be used to mint an
 * arbitrary owner (the caller cannot influence which account is promoted).
 */
export async function bootstrapSuperAdminImpl() {
  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    return {
      ok: false as const,
      reason: "SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD not configured",
    };
  }

  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // Resolve (or create) the auth user for the CONFIGURED address. Scoped to the
  // configured email so a stale/mistyped owner account never blocks the real one.
  let userId: string | null = null;
  const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Platform Owner" },
  });
  let wasCreated = false;
  if (created?.user) {
    userId = created.user.id;
    wasCreated = true;
  } else {
    const { data: list } = await supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1000 });
    const found = (list?.users ?? []).find(
      (u) => (u.email ?? "").toLowerCase() === email.toLowerCase(),
    );
    if (!found)
      return { ok: false as const, reason: createErr?.message ?? "Could not resolve account" };
    userId = found.id;
    // Keep the account in sync with the configured secret (and confirmed).
    await supabaseAdmin.auth.admin.updateUserById(userId, { password, email_confirm: true });
  }

  const { data: existing } = await supabaseAdmin
    .from("user_roles")
    .select("user_id")
    .eq("role", "super_admin")
    .eq("user_id", userId)
    .limit(1);
  if ((existing ?? []).length === 0) {
    const { error: roleErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "super_admin" });
    if (roleErr && !roleErr.message.toLowerCase().includes("duplicate")) {
      return { ok: false as const, reason: roleErr.message };
    }
  }

  await supabaseAdmin
    .from("profiles")
    .update({ is_active: true, status: "active" })
    .eq("id", userId);

  return { ok: true as const, created: wasCreated };
}
