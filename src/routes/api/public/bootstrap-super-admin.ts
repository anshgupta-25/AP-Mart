import { createFileRoute } from "@tanstack/react-router";
import { bootstrapSuperAdminImpl } from "@/lib/superadmin.functions";

/**
 * One-time Super Admin provisioning endpoint.
 *
 * Credentials come from the SUPER_ADMIN_EMAIL / SUPER_ADMIN_PASSWORD server
 * secrets — never from the request, never from client code. The underlying
 * implementation refuses to run once a super_admin exists, so this cannot be
 * abused to create additional platform owners.
 */
export const Route = createFileRoute("/api/public/bootstrap-super-admin")({
  server: {
    handlers: {
      POST: async () => {
        const result = await bootstrapSuperAdminImpl();
        return Response.json(result, { status: result.ok ? 200 : 400 });
      },
    },
  },
});
