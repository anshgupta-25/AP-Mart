import { createFileRoute } from "@tanstack/react-router";
import { TicketView } from "@/components/support/TicketView";

export const Route = createFileRoute("/admin/complaints/$id")({
  head: () => ({ meta: [{ title: "Complaint — AP Mart Admin" }] }),
  component: Page,
});

function Page() {
  const { id } = Route.useParams();
  return <TicketView id={id} />;
}
