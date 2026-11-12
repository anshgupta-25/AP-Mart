import { Link } from "@tanstack/react-router";
import { AnimatePresence, motion } from "framer-motion";
import { ShoppingBag, ArrowRight } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { rupees } from "@/lib/format";

export function FloatingCartBar() {
  const { items, subtotal, totalQty } = useCart();
  return (
    <AnimatePresence>
      {totalQty > 0 && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
          className="fixed left-3 right-3 z-30 bottom-[84px]"
        >
          <Link
            to="/customer/cart"
            className="block rounded-2xl bg-foreground text-background shadow-float px-4 py-3"
          >
            <div className="flex items-center gap-3">
              <div className="relative grid h-10 w-10 place-items-center rounded-xl bg-primary text-primary-foreground">
                <ShoppingBag className="h-5 w-5" />
                <span className="absolute -top-1 -right-1 h-5 min-w-5 px-1 grid place-items-center rounded-full bg-accent text-accent-foreground text-[10px] font-extrabold">
                  {totalQty}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-[11px] opacity-70 leading-none">
                  {items.length} {items.length === 1 ? "item" : "items"} in cart
                </div>
                <div className="font-extrabold text-[15px] leading-tight mt-0.5">
                  {rupees(subtotal)} <span className="opacity-60 font-medium text-[11px]">· Free delivery</span>
                </div>
              </div>
              <div className="inline-flex items-center gap-1 text-[12px] font-bold text-primary">
                View cart <ArrowRight className="h-4 w-4" />
              </div>
            </div>
          </Link>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
