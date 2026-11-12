import { createFileRoute } from "@tanstack/react-router";
import { OrderDetailView } from "@/components/OrderDetailView";

export const Route = createFileRoute("/customer/orders/$id")({
  head: ({ params }) => ({ meta: [{ title: `Order #${params.id.slice(0, 8)} — AP Mart` }] }),
  component: function Page() {
    const { id } = Route.useParams();
    return <OrderDetailView id={id} />;
  },
});
