import { createFileRoute } from "@tanstack/react-router";
import { TicketView } from "@/components/support/TicketView";

export const Route = createFileRoute("/support/tickets/$id")({
  head: () => ({ meta: [{ title: "Ticket — AP Mart" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return <TicketView id={id} />;
}
