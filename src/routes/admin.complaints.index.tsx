import { createFileRoute } from "@tanstack/react-router";
import { TicketsList } from "@/components/support/TicketsList";

export const Route = createFileRoute("/admin/complaints/")({
  head: () => ({ meta: [{ title: "Complaints — AP Mart Admin" }] }),
  component: () => (
    <TicketsList
      title="Complaints"
      rpc="admin_list_complaints"
      queryKey="admin-complaints"
      detail="admin"
    />
  ),
});
