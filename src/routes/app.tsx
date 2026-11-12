import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/app")({
  head: () => ({ meta: [{ title: "Open App — AP Mart" }] }),
  component: AppEntry,
});

function AppEntry() {
  const { user, loading, roles } = useAuth() as any;
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { redirect: "/app" } as any, replace: true });
      return;
    }
    const r: string[] = roles ?? [];
    if (r.includes("shopkeeper")) navigate({ to: "/shopkeeper/dashboard", replace: true });
    else if (r.includes("delivery")) navigate({ to: "/delivery/dashboard", replace: true });
    else if (r.includes("support")) navigate({ to: "/support/dashboard" as any, replace: true });
    else if (r.includes("admin")) navigate({ to: "/admin/dashboard", replace: true });
    else navigate({ to: "/customer/home", replace: true });
  }, [user, loading, roles, navigate]);


  return (
    <div className="min-h-screen grid place-items-center bg-background">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-sm font-semibold">Opening your app…</div>
      </div>
    </div>
  );
}
