import { createFileRoute, Navigate } from "@tanstack/react-router";
export const Route = createFileRoute("/customer/product/$id")({ component: () => <Navigate to="/products" /> });
