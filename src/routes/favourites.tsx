import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart } from "lucide-react";
import { useEffect, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { Skeleton } from "@/components/ui/skeleton";
import { useCustomerProducts } from "@/hooks/useCustomerProducts";

export const Route = createFileRoute("/favourites")({
  head: () => ({ meta: [{ title: "Favourites — AP Mart" }] }),
  component: FavouritesPage,
});

const KEY = "fb_favourites_v1";

function readFavs(): string[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; }
}

function FavouritesPage() {
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    setIds(readFavs());
    const onStorage = () => setIds(readFavs());
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const products = useCustomerProducts({ ids, limit: 100, key: "favs" });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <h1 className="font-display text-2xl md:text-3xl font-extrabold mb-4 flex items-center gap-2">
        <Heart className="h-6 w-6 text-primary fill-primary" /> Favourites
      </h1>

      {ids.length === 0 ? (
        <div className="text-center py-16">
          <div className="mx-auto h-16 w-16 grid place-items-center rounded-3xl bg-primary/10">
            <Heart className="h-8 w-8 text-primary" />
          </div>
          <p className="mt-3 font-bold">No favourites yet</p>
          <p className="text-sm text-muted-foreground mt-1">Tap the heart on any product to save it here.</p>
          <Link
            to="/products"
            className="mt-5 inline-block rounded-2xl gradient-primary px-5 py-2.5 font-bold text-primary-foreground shadow-glow text-sm"
          >
            Browse products →
          </Link>
        </div>
      ) : !products.data ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {products.data?.map((p) => <ProductCard key={p.id} product={p} />)}
        </div>
      )}
    </div>
  );
}
