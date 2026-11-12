import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/customer/shop")({ component: () => <Navigate to="/products" /> });
