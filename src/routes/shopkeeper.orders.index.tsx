import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/shopkeeper/orders/")({ component: () => <Navigate to="/shopkeeper/dashboard" /> });
