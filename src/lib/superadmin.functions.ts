import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

/**
 * Server-side Super Admin helpers.
 *
 * Every function here re-validates the caller's role against the database
 * (never against client-supplied data), so the hidden Super Admin surface
 * cannot be reached by simply knowing the route path.
 */
async function assertSuperAdmin(context: { supabase: SupabaseClient<Database>; userId: string }) {
  const { data, error } = await context.supabase.rpc("has_role", {
    _user_id: context.userId,
    _role: "super_admin",
  });
  if (error) throw new Error("Role validation failed");
  if (!data) throw new Error("Forbidden");
}

/**
 * Reports WHICH integration credentials are configured — never their values.
 * Showing a live key in a UI would be the single largest breach surface, so
 * only presence + last-four-style masking is returned.
 */
export const getIntegrationStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertSuperAdmin(context);

    // Client keys are inlined at build time, so also check the built value.
    const buildTimeEnv: Record<string, string | undefined> = {
      VITE_GOOGLE_MAPS_BROWSER_KEY: import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY,
    };
    const present = (name: string) => {
      const v = process.env[name] || buildTimeEnv[name];
      return { name, configured: !!v && v.length > 0 };
    };

    return {
      payments: [
        present("RAZORPAY_KEY_ID"),
        present("RAZORPAY_KEY_SECRET"),
        present("RAZORPAY_WEBHOOK_SECRET"),
      ],
      maps: [present("GOOGLE_MAPS_API_KEY"), present("VITE_GOOGLE_MAPS_BROWSER_KEY")],
      messaging: [
        present("FIREBASE_SERVICE_ACCOUNT_JSON"),
        present("WHATSAPP_API_TOKEN"),
        present("SMS_API_KEY"),
        present("RESEND_API_KEY"),
      ],
      bootstrap: [present("SUPER_ADMIN_EMAIL"), present("SUPER_ADMIN_PASSWORD")],
    };
  });
