import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { useAuth, homeForRoles } from "@/hooks/useAuth";

export const Route = createFileRoute("/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — AP Mart" }] }),
  component: DashboardRedirect,
});

function DashboardRedirect() {
  const { user, loading, rolesLoading, roles } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading || rolesLoading) return;
    if (!user) {
      navigate({ to: "/login", replace: true });
      return;
    }
    navigate({ to: homeForRoles(roles), replace: true });
  }, [user, loading, rolesLoading, roles, navigate]);

  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="flex flex-col items-center gap-3">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <p className="text-xs text-muted-foreground">Taking you to your dashboard…</p>
      </div>
    </div>
  );
}
