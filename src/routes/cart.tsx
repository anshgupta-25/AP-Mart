import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { AuthRequired } from "@/components/AuthRequired";

export const Route = createFileRoute("/cart")({
  head: () => ({
    meta: [
      { title: "Your cart — AP Mart" },
      { name: "description", content: "Review the groceries in your AP Mart cart and check out in minutes." },
      { property: "og:title", content: "Your cart — AP Mart" },
      { property: "og:description", content: "Review the groceries in your AP Mart cart and check out in minutes." },
    ],
  }),
  component: CartGate,
});

function CartGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-[60vh] grid place-items-center">
        <Loader2 className="h-7 w-7 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return <AuthRequired next="/customer/cart" />;

  return <Navigate to="/customer/cart" replace />;
}
