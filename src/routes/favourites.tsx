import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/favourites")({
  head: () => ({ meta: [{ title: "Saved items — AP Mart" }] }),
  component: () => <Navigate to="/customer/wishlist" replace />,
});
