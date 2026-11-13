import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ChevronRight, MapPin, Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";
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
  const { addressLabel } = useDeliveryContext();
  const navigate = useNavigate();

  if (!loading && items.length === 0) {
    return (
      <div className="px-4 py-24 text-center">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-tint-mint text-primary-ink">
          <ShoppingBag className="h-5 w-5" strokeWidth={1.8} />
        </div>
        <h2 className="mt-4 text-subtitle font-semibold">Your cart is empty</h2>
        <p className="mt-1 text-meta text-muted-foreground">
          Add items from nearby shops to get started.
        </p>
        <Link
          to="/customer/categories"
          className="press mt-5 inline-flex h-11 items-center rounded-xl bg-primary px-6 text-body font-semibold text-primary-foreground"
        >
          Browse products
        </Link>
      </div>
    );
  }

  const deliveryFee = subtotal >= 199 ? 0 : 25;
  const total = subtotal + deliveryFee;

  return (
    <div className="mx-auto max-w-2xl space-y-4 px-4 pb-44 pt-4">
      <div className="flex items-baseline justify-between">
        <h1 className="large-title">Cart</h1>
        <span className="text-small text-muted-foreground">
          {items.length} {items.length === 1 ? "item" : "items"}
        </span>
      </div>

      <CartShopSelector />

      <div className="divide-y divide-border/60 overflow-hidden rounded-xl border border-border/70 bg-card">
        {items.map((l) => (
          <div key={l.id} className="flex items-center gap-3 p-3">
            {(l.variant?.images?.[0] ?? l.product.image_url) ? (
              <StorageImg
                loading="lazy"
                decoding="async"
                src={l.variant?.images?.[0] ?? l.product.image_url!}
                alt={l.product.name}
                className="h-14 w-14 shrink-0 rounded-lg bg-secondary/60 object-contain p-1"
              />
            ) : (
              <div className="grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-secondary text-muted-foreground">
                <ShoppingBag className="h-5 w-5" strokeWidth={1.6} />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div className="line-clamp-2 text-meta font-medium leading-[17px]">
                {l.product.name}
              </div>
              <div className="mt-0.5 text-caption text-muted-foreground">
                {l.variant
                  ? `${l.variant.size}${l.variant.unit ? " " + l.variant.unit : ""}`
                  : l.product.unit}
              </div>
              <div className="mt-1 flex items-baseline gap-1.5">
                <span className="text-meta font-bold">{rupees(priceOf(l))}</span>
                {mrpOf(l) > priceOf(l) && (
                  <span className="text-caption text-muted-foreground line-through">
                    {rupees(mrpOf(l))}
                  </span>
                )}
              </div>
            </div>
            <div className="flex h-8 shrink-0 items-center rounded-full bg-primary text-primary-foreground">
              <button
                onClick={() => setQty(l.id, l.quantity - 1)}
                className="press grid h-8 w-8 place-items-center"
                aria-label="Decrease"
              >
                {l.quantity === 1 ? (
                  <Trash2 className="h-3.5 w-3.5" />
                ) : (
                  <Minus className="h-3.5 w-3.5" />
                )}
              </button>
              <span className="min-w-4 text-center text-meta font-semibold">{l.quantity}</span>
              <button
                onClick={() => setQty(l.id, l.quantity + 1)}
                className="press grid h-8 w-8 place-items-center"
                aria-label="Increase"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <Link
        to="/customer/profile"
        className="press flex items-center gap-3 rounded-xl border border-border/70 bg-card p-3"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-tint-mint text-primary-ink">
          <MapPin className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block text-caption text-muted-foreground">Delivering to</span>
          <span className="block truncate text-meta font-medium">
            {addressLabel ?? "Choose your address"}
          </span>
        </span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
      </Link>

      <section>
        <h3 className="section-title mb-2">Bill details</h3>
        <div className="rounded-xl border border-border/70 bg-card px-4 py-3">
          <Row label="Item total" value={rupees(subtotal)} />
          {savings > 0 && (
            <Row label="You save" value={`- ${rupees(savings)}`} className="text-success" />
          )}
          <Row label="Delivery fee" value={deliveryFee === 0 ? "Free" : rupees(deliveryFee)} />
          <Row label="Handling" value="At checkout" />
          <div className="my-2 h-px bg-border/60" />
          <Row label="To pay" value={rupees(total)} bold />
        </div>
      </section>

      <div className="bar-blur hairline-t fixed inset-x-0 bottom-[calc(60px+env(safe-area-inset-bottom))] z-20 px-4 py-3">
        <Button
          onClick={() => navigate({ to: "/checkout" })}
          disabled={loading || items.length === 0}
          className="mx-auto flex h-11 w-full max-w-2xl justify-between rounded-xl"
        >
          <span>{rupees(total)}</span>
          <span>Proceed to pay</span>
        </Button>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  className,
}: {
  label: string;
  value: string;
  bold?: boolean;
  className?: string;
}) {
  return (
    <div
      className={`flex justify-between py-1 text-meta ${bold ? "text-body font-semibold" : "text-muted-foreground"} ${className ?? ""}`}
    >
      <span>{label}</span>
      <span className={bold || className ? "" : "text-foreground"}>{value}</span>
    </div>
  );
}
