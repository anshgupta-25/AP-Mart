import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/customer/checkout")({ component: () => <Navigate to="/checkout" /> });
