import { createFileRoute } from "@tanstack/react-router";
import { CouponsManager } from "@/components/CouponsManager";

export const Route = createFileRoute("/admin/coupons")({
  head: () => ({ meta: [{ title: "Coupons — Admin" }] }),
  component: () => (
    <div className="mx-auto w-full max-w-4xl px-4 py-4 md:px-6 md:py-6">
      <CouponsManager />
    </div>
  ),
});
