import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

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
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Guests: show the favourites saved on this device (same as /favourites).
  if (!user) return <Navigate to="/favourites" replace />;

  return <Navigate to="/customer/wishlist" replace />;
}
