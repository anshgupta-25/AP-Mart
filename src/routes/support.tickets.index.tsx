import { createFileRoute } from "@tanstack/react-router";
import { TicketsList } from "@/components/support/TicketsList";

export const Route = createFileRoute("/support/tickets/")({
  head: () => ({ meta: [{ title: "Support Tickets — AP Mart" }] }),
  component: () => (
    <TicketsList rpc="support_list_complaints" queryKey="support-tickets-list" detail="support" />
  ),
});
