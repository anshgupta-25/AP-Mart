import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Heart, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthRequired } from "@/components/AuthRequired";

export const Route = createFileRoute("/wishlist")({
  head: () => ({
    meta: [
      { title: "Your favourites — AP Mart" },
      { name: "description", content: "All the AP Mart products you saved for later, in one place." },
      { property: "og:title", content: "Your favourites — AP Mart" },
      { property: "og:description", content: "All the AP Mart products you saved for later, in one place." },
    ],
  }),
  component: WishlistGate,
});

function WishlistGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <AuthRequired
        next="/customer/wishlist"
        title="Save Your Favourites"
        description="Sign in to keep your favourite products handy and reorder them in one tap."
        icon={<Heart className="h-12 w-12 text-primary" strokeWidth={1.75} />}
      />
    );
  }

  return <Navigate to="/customer/wishlist" replace />;
}
