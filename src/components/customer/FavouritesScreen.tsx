import { Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useWishlist } from "@/hooks/useWishlist";
import { useCustomerProducts } from "@/hooks/useCustomerProducts";

/** Saved items grid. Works for guests (device storage) and signed-in users (useWishlist). */
export function FavouritesScreen({ browseTo = "/customer/categories" }: { browseTo?: "/customer/categories" | "/products" }) {
  const { ids, loading: wlLoading } = useWishlist();

  const products = useCustomerProducts({ ids, limit: 100, key: "wishlist" });

  const skeletons = (
    <div className="grid grid-cols-3 gap-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[200px] rounded-xl" />
      ))}
    </div>
  );

  return (
    <div>
      <div className="hairline-b bg-tint-mint px-4 pb-3 pt-4">
        <h1 className="large-title">Favourites</h1>
        <p className="mt-0.5 text-small text-muted-foreground">
          {ids.length > 0 ? `${ids.length} saved ${ids.length === 1 ? "item" : "items"}` : "Items you save show up here"}
        </p>
      </div>

      <div className="px-4 pb-6 pt-4">
        {wlLoading ? (
          skeletons
        ) : ids.length === 0 ? (
          <div className="py-16 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-tint-rose text-destructive">
              <Heart className="h-6 w-6" strokeWidth={1.8} />
            </div>
            <h2 className="section-title mt-4">No favourites yet</h2>
            <p className="mt-1 text-meta text-muted-foreground">Tap the heart on any product to save it here.</p>
            <Link
              to={browseTo}
              className="press mt-5 inline-flex h-11 items-center rounded-xl bg-primary px-6 text-body font-semibold text-primary-foreground"
            >
              Browse products
            </Link>
          </div>
        ) : !products.data ? (
          skeletons
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {products.data?.map((p) => (
              <div key={p.id} className="pb-3">
                <ProductCard product={p} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
