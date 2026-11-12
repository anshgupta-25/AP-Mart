import { createFileRoute } from "@tanstack/react-router";
import { CouponsManager } from "@/components/CouponsManager";

export const Route = createFileRoute("/admin/coupons")({
  head: () => ({ meta: [{ title: "Coupons — Admin" }] }),
  component: () => (
    <div className="p-4 max-w-4xl mx-auto">
      <CouponsManager />
    </div>
  ),
});
