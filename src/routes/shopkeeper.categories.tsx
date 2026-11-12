import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/shopkeeper/categories")({
  head: () => ({ meta: [{ title: "403 Access Denied — Shopkeeper" }] }),
  component: AccessDenied,
});

/**
 * Category management is Admin-only. Shopkeepers who reach this URL manually
 * get a 403 screen and are bounced back to their dashboard.
 */
function AccessDenied() {
  const navigate = useNavigate();

  useEffect(() => {
    const t = setTimeout(() => navigate({ to: "/shopkeeper/dashboard", replace: true }), 2500);
    return () => clearTimeout(t);
  }, [navigate]);

  return (
    <div className="grid min-h-[70vh] place-items-center p-6">
      <div className="max-w-md space-y-3 text-center">
        <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-destructive/10">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="font-display text-2xl font-extrabold">403 — Access Denied</h1>
        <p className="text-sm text-muted-foreground">
          Category management is handled by the AP Mart admin team. You can select existing
          categories while adding or editing products.
        </p>
        <Button
          className="rounded-xl font-bold"
          onClick={() => navigate({ to: "/shopkeeper/dashboard", replace: true })}
        >
          Back to Dashboard
        </Button>
        <p className="text-xs text-muted-foreground">Redirecting automatically…</p>
      </div>
    </div>
  );
}
