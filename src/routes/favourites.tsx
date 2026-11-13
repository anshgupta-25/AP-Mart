import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { FavouritesScreen } from "@/components/customer/FavouritesScreen";
import { useAuth } from "@/hooks/useAuth";

export const Route = createFileRoute("/favourites")({
  head: () => ({ meta: [{ title: "Saved items — AP Mart" }] }),
  component: FavouritesPage,
});

/** Guests see items saved on this device; signed-in customers use their account wishlist. */
function FavouritesPage() {
  const { user, loading } = useAuth();
  // Don't flash the empty guest list for a signed-in user while auth loads.
  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }
  if (user) return <Navigate to="/customer/wishlist" replace />;
  return <FavouritesScreen browseTo="/products" />;
}
