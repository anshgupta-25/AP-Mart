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
    <div className="mx-auto max-w-6xl space-y-5 px-4 py-4 md:px-6">
      {!isAdmin && (
        <div className="rounded-xl bg-tint-sky p-4 text-meta leading-relaxed text-foreground/70">
          Promo codes are managed by the platform admin. You can view all live coupons below — share these codes with your customers to boost sales.
        </div>
      )}
      <CouponsManager readOnly={!isAdmin} />
    </div>
  );
}
