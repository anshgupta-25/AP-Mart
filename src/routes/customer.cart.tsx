import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Minus, Plus, Trash2, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useCart } from "@/hooks/useCart";
import { Button } from "@/components/ui/button";
import { rupees } from "@/lib/format";
import { CartShopSelector } from "@/components/CartShopSelector";
import { StorageImg } from "@/components/StorageImg";

export const Route = createFileRoute("/customer/cart")({
  head: () => ({ meta: [{ title: "Cart — AP Mart" }] }),
  component: AppCart,
});

function AppCart() {
  const { items, subtotal, savings, setQty, loading, priceOf, mrpOf } = useCart();
  const navigate = useNavigate();


  if (!loading && items.length === 0) {
    return (
      <div className="px-4 py-20 text-center">
        <div className="text-7xl">🛒</div>
        <h2 className="font-display text-2xl font-bold mt-4">Your cart is empty</h2>
        <p className="text-muted-foreground mt-2 text-sm">Looks like you haven't added anything yet.</p>
        <Link
          to="/customer/categories"
          className="mt-6 inline-block rounded-2xl gradient-primary px-6 py-3 font-bold text-primary-foreground shadow-glow"
        >
          Continue Shopping
        </Link>
      </div>
    );
  }

  const deliveryFee = subtotal >= 199 ? 0 : 25;
  const total = subtotal + deliveryFee;

  return (
    <div className="px-4 py-4 pb-40">
      <h1 className="font-display text-2xl font-extrabold mb-4">Your cart ({items.length})</h1>

      <CartShopSelector />

      <div className="space-y-3">
        <AnimatePresence>
          {items.map((l) => (
            <motion.div
              key={l.id}
              layout
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, x: -50 }}
              className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 shadow-card"
            >
              {(l.variant?.images?.[0] ?? l.product.image_url) ? (
                <StorageImg loading="lazy" decoding="async" src={l.variant?.images?.[0] ?? l.product.image_url!} alt={l.product.name} className="h-16 w-16 rounded-xl object-cover" />
              ) : (
                <div className="h-16 w-16 rounded-xl bg-secondary grid place-items-center text-2xl">🛒</div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm line-clamp-1">{l.product.name}</div>
                <div className="text-[11px] text-muted-foreground">
                  {l.variant ? `${l.variant.size}${l.variant.unit ? " " + l.variant.unit : ""}` : l.product.unit}
                </div>
                <div className="mt-1 flex items-center gap-2">
                  <span className="font-bold text-sm">{rupees(priceOf(l))}</span>
                  {mrpOf(l) > priceOf(l) && (
                    <span className="text-[11px] text-muted-foreground line-through">{rupees(mrpOf(l))}</span>
                  )}
                </div>

              </div>
              <div className="flex items-center gap-1 rounded-xl gradient-primary text-primary-foreground">
                <button onClick={() => setQty(l.id, l.quantity - 1)} className="h-9 w-9 grid place-items-center">
                  {l.quantity === 1 ? <Trash2 className="h-4 w-4" /> : <Minus className="h-4 w-4" />}
                </button>
                <span className="w-6 text-center text-sm font-bold">{l.quantity}</span>
                <button onClick={() => setQty(l.id, l.quantity + 1)} className="h-9 w-9 grid place-items-center">
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      <div className="mt-5 rounded-3xl border border-border bg-card p-4 shadow-card">
        <h3 className="font-display text-base font-bold mb-2">Bill details</h3>
        <Row label="Item total" value={rupees(subtotal)} />
        {savings > 0 && <Row label="You save" value={`- ${rupees(savings)}`} className="text-success" />}
        <Row label="Delivery fee" value={deliveryFee === 0 ? "FREE" : rupees(deliveryFee)} />
        <Row label="Handling" value="At checkout" />
        <div className="my-2 h-px bg-border" />
        <Row label="To pay" value={rupees(total)} bold />
      </div>

      {/* Sticky checkout */}
      <div className="fixed bottom-16 left-0 right-0 z-20 px-4 pb-3">
        <Button
          onClick={() => navigate({ to: "/checkout" })}
          disabled={loading || items.length === 0}
          className="w-full h-12 rounded-2xl gradient-primary text-primary-foreground font-bold shadow-glow"
        >
          <Zap className="h-4 w-4 mr-2 fill-current" /> Checkout · {rupees(total)}
        </Button>
      </div>
    </div>
  );
}

function Row({ label, value, bold, className }: { label: string; value: string; bold?: boolean; className?: string }) {
  return (
    <div className={`flex justify-between py-1 text-sm ${bold ? "font-bold text-base" : ""} ${className ?? ""}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
