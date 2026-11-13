import { createFileRoute } from "@tanstack/react-router";
import { FavouritesScreen } from "@/components/customer/FavouritesScreen";

export const Route = createFileRoute("/customer/wishlist")({
  head: () => ({ meta: [{ title: "Favourites — AP Mart" }] }),
  component: () => <FavouritesScreen />,
});
