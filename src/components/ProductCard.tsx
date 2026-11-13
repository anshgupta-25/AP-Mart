import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Minus, Heart, Star } from "lucide-react";
import { useCart } from "@/hooks/useCart";
import { useWishlist } from "@/hooks/useWishlist";
import { ProductImage } from "@/components/ProductImage";
import { rupees, pct } from "@/lib/format";

export interface ProductCardData {
  id: string;
  slug: string;
  name: string;
  unit: string;
  price: number;
  mrp: number;
  image_url: string | null;
  delivery_minutes: number;
  stock: number;
  rating?: number | null;
}

function ProductCardImpl({ product }: { product: ProductCardData }) {
  const { items, add, setQty } = useCart();
  const { isFav, toggle } = useWishlist();
  const line = items.find((l) => l.product_id === product.id);
  const discount = pct(product.price, product.mrp);
  const outOfStock = product.stock <= 0;
  const lowStock = !outOfStock && product.stock <= 5;
  const fav = isFav(product.id);

  return (
    <div className="flex h-full flex-col rounded-xl border border-border/70 bg-card p-2">
      <div className="relative">
        <Link to="/product/$slug" params={{ slug: product.slug }} className="block">
          <ProductImage
            src={product.image_url}
            alt={product.name}
            fit="contain"
            className="aspect-square w-full rounded-lg bg-secondary/60 p-1.5"
            fallbackClassName="text-3xl"
          />
        </Link>
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            toggle(product.id);
          }}
          className="absolute right-1 top-1 grid h-6 w-6 place-items-center rounded-full bg-card/90"
          aria-label={fav ? "Remove from wishlist" : "Add to wishlist"}
        >
          <Heart
            className={fav ? "text-destructive" : "text-muted-foreground"}
            fill={fav ? "currentColor" : "none"}
            size={14}
          />
        </button>

        <div className="absolute -bottom-3.5 right-1 z-10">
          {outOfStock ? (
            <span className="inline-flex h-7 items-center rounded-lg border border-border bg-card px-2 text-micro font-semibold text-muted-foreground">
              Sold out
            </span>
          ) : line ? (
            <div className="flex h-7 items-center rounded-lg bg-primary text-primary-foreground shadow-soft">
              <button onClick={() => setQty(line.id, line.quantity - 1)} className="grid h-7 w-6 place-items-center" aria-label="Decrease">
                <Minus className="h-3 w-3" strokeWidth={2.6} />
              </button>
              <span className="min-w-3.5 text-center text-small font-bold">{line.quantity}</span>
              <button onClick={() => setQty(line.id, line.quantity + 1)} className="grid h-7 w-6 place-items-center" aria-label="Increase">
                <Plus className="h-3 w-3" strokeWidth={2.6} />
              </button>
            </div>
          ) : (
            <button
              onClick={() => add(product.id, 1)}
              className="press h-7 rounded-lg border border-primary bg-card px-3.5 text-caption font-bold tracking-wide text-primary shadow-soft"
              aria-label={`Add ${product.name}`}
            >
              ADD
            </button>
          )}
        </div>
      </div>

      <div className="mt-2 truncate pr-14 text-caption text-muted-foreground">{product.unit}</div>

      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="text-meta font-bold">{rupees(product.price)}</span>
        {product.mrp > product.price && (
          <span className="text-caption text-muted-foreground line-through">{rupees(product.mrp)}</span>
        )}
      </div>
      {discount > 0 && <div className="text-micro font-semibold text-primary">{discount}% OFF</div>}

      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        className="mt-0.5 line-clamp-2 min-h-[30px] text-small font-medium leading-[15px]"
      >
        {product.name}
      </Link>

      <div className="mt-1 flex h-4 items-center gap-2 text-micro text-muted-foreground">
        {product.rating != null && product.rating > 0 && (
          <span className="inline-flex items-center gap-0.5">
            <Star className="h-2.5 w-2.5 fill-accent text-accent" />
            {product.rating.toFixed(1)}
          </span>
        )}
        {lowStock && <span className="font-medium text-destructive">{product.stock} left</span>}
      </div>
    </div>
  );
}

export const ProductCard = memo(ProductCardImpl);
