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
    <div className="grid min-h-[70vh] place-items-center p-4">
      <div className="max-w-md space-y-3 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-tint-rose">
          <ShieldAlert className="h-7 w-7 text-destructive" />
        </div>
        <h1 className="large-title">Access denied</h1>
        <p className="text-body text-muted-foreground">
          Category management is handled by the AP Mart admin team. You can select existing
          categories while adding or editing products.
        </p>
        <Button
          className="h-11 w-full rounded-xl"
          onClick={() => navigate({ to: "/shopkeeper/dashboard", replace: true })}
        >
          Back to Dashboard
        </Button>
        <p className="text-small text-muted-foreground">Redirecting automatically…</p>
      </div>
    </div>
  );
}
