import { createFileRoute } from "@tanstack/react-router";
import { OrdersList } from "@/components/customer/OrdersList";

export const Route = createFileRoute("/orders/")({
  head: () => ({ meta: [{ title: "My orders — AP Mart" }] }),
  component: () => <OrdersList detail="public" next="/orders" />,
});
