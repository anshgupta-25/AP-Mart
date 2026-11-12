import { createFileRoute, Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/customer/dashboard")({
  head: () => ({ meta: [{ title: "Customer — AP Mart" }] }),
  component: () => <Navigate to="/customer/home" replace />,
});
