import { createFileRoute } from "@tanstack/react-router";
import { CouponsManager } from "@/components/CouponsManager";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/shopkeeper/coupons")({
  head: () => ({ meta: [{ title: "Coupons — Shopkeeper" }] }),
  component: ShopkeeperCouponsPage,
});

function ShopkeeperCouponsPage() {
  const { roles } = useAuth() as any;
  const isAdmin = (roles ?? []).includes("admin");
  return (
    <div className="p-4 max-w-4xl mx-auto space-y-3">
      {!isAdmin && (
        <div className="rounded-2xl border border-border bg-secondary/50 p-3 text-xs text-muted-foreground">
          Promo codes are managed by the platform admin. You can view all live coupons below — share these codes with your customers to boost sales.
        </div>
      )}
      <CouponsManager readOnly={!isAdmin} />
    </div>
  );
}
