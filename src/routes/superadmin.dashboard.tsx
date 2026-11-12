import { createFileRoute, redirect } from "@tanstack/react-router";

// Alias: /superadmin/dashboard -> the Super Admin portal (access is still enforced there).
export const Route = createFileRoute("/superadmin/dashboard")({
  beforeLoad: () => {
    throw redirect({ to: "/super-admin/dashboard", replace: true });
  },
});
