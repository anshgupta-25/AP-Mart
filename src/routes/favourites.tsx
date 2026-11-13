import { createFileRoute, Navigate } from "@tanstack/react-router";
import { FavouritesScreen } from "@/components/customer/FavouritesScreen";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/favourites")({
  head: () => ({ meta: [{ title: "Saved items — AP Mart" }] }),
  component: FavouritesPage,
});

/** Guests see items saved on this device; signed-in customers use their account wishlist. */
function FavouritesPage() {
  const { user, loading } = useAuth();
  if (!loading && user) return <Navigate to="/customer/wishlist" replace />;
  return <FavouritesScreen browseTo="/products" />;
}
