import { memo } from "react";
import { Link } from "@tanstack/react-router";
import { Plus, Minus, Heart, Star } from "lucide-react";
import { motion } from "framer-motion";
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
  const fav = isFav(product.id);

  const toggleFav = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    toggle(product.id);
  };

  return (
    <motion.div
      whileTap={{ scale: 0.98 }}
      className="group relative flex h-full flex-col rounded-2xl border border-border bg-card p-2.5 shadow-card hover:shadow-card-premium transition-shadow"
    >
      {/* Discount chip */}
      {discount > 0 && (
        <div className="absolute top-2 left-2 z-10 rounded-md bg-accent px-1.5 py-0.5 text-[10px] font-extrabold text-accent-foreground shadow-soft">
          {discount}% OFF
        </div>
      )}
      {/* Wishlist */}
      <button
        onClick={toggleFav}
        className="absolute top-2 right-2 z-10 h-7 w-7 grid place-items-center rounded-full bg-card/90 backdrop-blur border border-border"
        aria-label={fav ? "Remove from wishlist" : "Add to wishlist"}
      >
        <Heart
          className={fav ? "text-destructive" : "text-muted-foreground"}
          fill={fav ? "currentColor" : "none"}
          size={14}
        />
      </button>

      <Link to="/product/$slug" params={{ slug: product.slug }} className="block">
        <ProductImage
          src={product.image_url}
          alt={product.name}
          className="aspect-square w-full rounded-xl"
          imgClassName="transition-transform group-hover:scale-[1.03]"
          fallbackClassName="text-4xl"
        />
      </Link>

      {/* Delivery ETA pill */}
      <div className="mt-2 inline-flex items-center gap-1 rounded-md bg-secondary px-1.5 py-0.5 text-[9px] font-bold text-foreground/70 w-fit">
        ⚡ {product.delivery_minutes} MIN
      </div>

      <Link
        to="/product/$slug"
        params={{ slug: product.slug }}
        className="mt-1 line-clamp-2 min-h-[34px] text-[13px] font-semibold leading-tight"
      >
        {product.name}
      </Link>
      <div className="text-[11px] text-muted-foreground">{product.unit}</div>

      {/* Rating row height is always reserved so cards stay the same size */}
      <div className="mt-1 flex h-[14px] items-center gap-1 text-[10px] text-muted-foreground">
        {product.rating != null && product.rating > 0 && (
          <>
            <Star className="h-3 w-3 fill-accent text-accent" />
            <span className="font-semibold text-foreground">{product.rating.toFixed(1)}</span>
          </>
        )}
      </div>


      <div className="mt-auto pt-2 flex items-end justify-between gap-2">
        <div className="leading-tight">
          <div className="font-extrabold text-[14px]">{rupees(product.price)}</div>
          {product.mrp > product.price && (
            <div className="text-[11px] text-muted-foreground line-through">{rupees(product.mrp)}</div>
          )}
        </div>
        {outOfStock ? (
          <button disabled className="h-8 rounded-lg border border-border px-3 text-[11px] font-bold text-muted-foreground">
            Out
          </button>
        ) : line ? (
          <div className="flex items-center rounded-lg bg-primary text-primary-foreground">
            <button
              onClick={() => setQty(line.id, line.quantity - 1)}
              className="h-8 w-8 grid place-items-center"
              aria-label="Decrease"
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
            <span className="w-5 text-center text-[12px] font-extrabold">{line.quantity}</span>
            <button
              onClick={() => setQty(line.id, line.quantity + 1)}
              className="h-8 w-8 grid place-items-center"
              aria-label="Increase"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <motion.button
            whileTap={{ scale: 0.92 }}
            onClick={() => add(product.id, 1)}
            className="h-8 rounded-lg border-2 border-primary bg-primary/5 px-3.5 text-[12px] font-extrabold text-primary hover:bg-primary hover:text-primary-foreground transition"
          >
            ADD
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export const ProductCard = memo(ProductCardImpl);
