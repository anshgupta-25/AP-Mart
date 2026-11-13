import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { rupees } from "@/lib/format";

export function FloatingCartBar() {
  const { items, subtotal, totalQty } = useCart();
  if (totalQty <= 0) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 px-4 md:bottom-6">
      <Link
        to="/customer/cart"
        className="press pointer-events-auto mx-auto flex max-w-md items-center justify-between rounded-2xl bg-primary px-4 py-3.5 text-primary-foreground shadow-float"
      >
        <div className="flex items-center gap-3">
          <span className="grid h-8 min-w-8 place-items-center rounded-full bg-white/20 px-2 text-meta font-semibold">
            {totalQty}
          </span>
          <div className="leading-tight">
            <div className="text-subtitle font-semibold">View cart</div>
            <div className="text-small opacity-85">
              {items.length} {items.length === 1 ? "item" : "items"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 text-subtitle font-semibold">
          {rupees(subtotal)} <ChevronRight className="h-4 w-4 opacity-80" />
        </div>
      </Link>
    </div>
  );
}
