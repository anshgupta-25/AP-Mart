import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { createClient } from "@supabase/supabase-js";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/** What blocks deletion (shown on the delete screen with a link to fix it). */
export type DeletionBlocker = "orders" | "shop_orders" | "deliveries" | "last_super_admin";

export type DeletionCheck = {
  allowed: boolean;
  reason?: string;
  roles?: string[];
  active_count?: number;
  blocker?: DeletionBlocker;
  /** False for Google sign-ins (no password): the screen asks for an emailed code instead. */
  has_password?: boolean;
};

const CODE_COOLDOWN_MS = 45_000;
const ATTACHMENTS_BUCKET = "support-attachments";
// Per-instance, in-memory brake on code emails (one per user per 45s).
const lastCodeSent = new Map<string, number>();

/**
 * Origin for links/logo in emails. PUBLIC_SITE_URL in production; the request's own origin
 * (client-controlled Host header) is only trusted for localhost (same rule as auth-email).
 */
function siteUrl(): string {
  const fromEnv = (process.env.PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const origin = new URL(getRequest().url);
  if (/^(localhost|127\.0\.0\.1)$/.test(origin.hostname)) return origin.origin;
  throw new Error("Email is not configured yet. Please try again later.");
}

/** A throwaway client used only to check a password or code; it keeps no session anywhere. */
function credentialClient() {
  return createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_PUBLISHABLE_KEY!, {
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

/** "storage://support-attachments/<path>" -> "<path>" (other buckets/URLs -> null). */
function attachmentPath(ref: string | null | undefined): string | null {
  const prefix = `storage://${ATTACHMENTS_BUCKET}/`;
  return ref?.startsWith(prefix) ? ref.slice(prefix.length) : null;
}

/**
 * Reports whether the signed-in user may delete their own account, and why not.
 * Always scoped to auth.uid() inside the database function.
 */
export const checkAccountDeletion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase.rpc("account_deletion_check");
    if (error) throw new Error(error.message);
    return (data ?? { allowed: false, reason: "Unable to verify account" }) as DeletionCheck;
  });

/** Emails the signed-in user an 8-digit code that confirms the deletion (for accounts without a password). */
export const sendAccountDeletionCode = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const wait = CODE_COOLDOWN_MS - (Date.now() - (lastCodeSent.get(context.userId) ?? 0));
    if (wait > 0)
      throw new Error(`A code was sent recently. Please wait ${Math.ceil(wait / 1000)}s.`);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { sendEmail, deleteAccountCodeEmail } = await import("@/lib/emails.server");
    const site = siteUrl();
    const { data: found, error: userError } = await supabaseAdmin.auth.admin.getUserById(
      context.userId,
    );
    const email = found?.user?.email;
    if (userError || !email) throw new Error("Couldn't find your account email.");

    const { data, error } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email,
    });
    if (error || !data?.properties?.email_otp)
      throw new Error("Couldn't create a code. Try again.");
    await sendEmail(deleteAccountCodeEmail({ to: email, code: data.properties.email_otp, site }));
    lastCodeSent.set(context.userId, Date.now());
    return { sentTo: email };
  });

/**
 * Permanently deletes the CALLER's account. The user id comes from the verified bearer token,
 * never from request data, so nobody can delete another account. The user must prove it's them
 * again: their password, or the code from `sendAccountDeletionCode`.
 * Order: verify -> eligibility -> purge (database) -> attachment files -> auth user -> email.
 */
export const deleteMyAccount = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator((input: { password?: string; code?: string }) => ({
    password: typeof input?.password === "string" ? input.password : "",
    code: typeof input?.code === "string" ? input.code.replace(/\D/g, "") : "",
  }))
  .handler(async ({ context, data: input }) => {
    const uid = context.userId;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: found, error: userError } = await supabaseAdmin.auth.admin.getUserById(uid);
    const email = found?.user?.email;
    if (userError || !email) throw new Error("Couldn't find your account email.");

    // 1. Re-authenticate.
    const verifier = credentialClient();
    if (input.password) {
      const { data, error } = await verifier.auth.signInWithPassword({
        email,
        password: input.password,
      });
      if (error || data.user?.id !== uid) throw new Error("That password isn't right.");
    } else if (input.code) {
      const { data, error } = await verifier.auth.verifyOtp({
        email,
        token: input.code,
        type: "email",
      });
      if (error || data.user?.id !== uid)
        throw new Error("That code is wrong or has expired. Request a new one.");
    } else {
      throw new Error("Confirm with your password or the code we emailed you.");
    }

    // 2. Eligibility (the purge re-checks this inside the database too).
    const check = await context.supabase.rpc("account_deletion_check");
    if (check.error) throw new Error(check.error.message);
    const verdict = check.data as DeletionCheck | null;
    if (!verdict?.allowed) throw new Error(verdict?.reason ?? "Account cannot be deleted");

    // 3. Support attachment files to remove: everything on the user's own tickets, and the
    //    user's uploads that are not part of someone else's ticket (an agent's replies stay).
    const { data: tickets } = await supabaseAdmin
      .from("support_tickets")
      .select("id")
      .eq("user_id", uid);
    const ticketIds = (tickets ?? []).map((t) => t.id);
    const [{ data: ownTicketFiles }, { data: myUploads }, { data: uploadedFolder }] =
      await Promise.all([
        ticketIds.length
          ? supabaseAdmin.from("ticket_attachments").select("file_url").in("ticket_id", ticketIds)
          : Promise.resolve({ data: [] as { file_url: string }[] }),
        supabaseAdmin
          .from("ticket_attachments")
          .select("file_url, ticket_id")
          .eq("uploaded_by", uid),
        supabaseAdmin.storage.from(ATTACHMENTS_BUCKET).list(uid, { limit: 1000 }),
      ]);
    const keep = new Set(
      (myUploads ?? [])
        .filter((a) => !ticketIds.includes(a.ticket_id))
        .map((a) => attachmentPath(a.file_url)),
    );
    const toRemove = new Set<string>();
    for (const a of ownTicketFiles ?? []) {
      const p = attachmentPath(a.file_url);
      if (p) toRemove.add(p);
    }
    for (const f of uploadedFolder ?? []) {
      const p = `${uid}/${f.name}`;
      if (f.id && !keep.has(p)) toRemove.add(p);
    }

    // 4. Purge / anonymise database rows (as the user: scoped to auth.uid()).
    const purge = await context.supabase.rpc("delete_my_account_data");
    if (purge.error) throw new Error(purge.error.message);

    // 5. Files. Best effort: a storage hiccup must not leave a half-deleted login behind.
    if (toRemove.size) {
      const { error } = await supabaseAdmin.storage.from(ATTACHMENTS_BUCKET).remove([...toRemove]);
      if (error) console.error("[delete-account] attachment cleanup failed:", error.message);
    }

    // 6. The login itself (profile and remaining personal rows cascade).
    const { error } = await supabaseAdmin.auth.admin.deleteUser(uid);
    if (error) throw new Error(error.message);

    // 7. Confirmation email. Best effort: the account is already gone.
    try {
      const { sendEmail, accountDeletedEmail } = await import("@/lib/emails.server");
      await sendEmail(accountDeletedEmail({ to: email, site: siteUrl() }));
    } catch (err) {
      console.error("[delete-account] confirmation email failed:", errorText(err));
    }

    return { ok: true };
  });

const errorText = (err: unknown) => (err instanceof Error ? err.message : String(err));
