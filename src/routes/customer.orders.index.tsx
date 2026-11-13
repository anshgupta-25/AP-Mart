import { createFileRoute } from "@tanstack/react-router";
import { OrdersList } from "@/components/customer/OrdersList";

export const Route = createFileRoute("/customer/orders/")({
  head: () => ({ meta: [{ title: "Orders — AP Mart" }] }),
  component: () => <OrdersList detail="customer" next="/customer/orders" />,
});
