import {
  createFileRoute,
  Navigate,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { StorefrontShell } from "@/components/shell/StorefrontShell";
import { useCustomerCatalogRealtime } from "@/hooks/useCustomerProducts";
import { AddressPromptSheet } from "@/components/customer/AddressPrompt";

export const Route = createFileRoute("/customer")({
  head: () => ({ meta: [{ title: "AP Mart — Groceries from shops near you" }] }),
  component: CustomerShell,
});

function CustomerShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, roles } = useAuth();
  const navigate = useNavigate();
  useCustomerCatalogRealtime();

  const onSetup = pathname.startsWith("/customer/address-setup");

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate({ to: "/login", search: { next: pathname } as never, replace: true });
      return;
    }
    const r: string[] = roles ?? [];
    if (r.includes("shopkeeper")) navigate({ to: "/shopkeeper/dashboard", replace: true });
    else if (r.includes("delivery")) navigate({ to: "/delivery/dashboard", replace: true });
  }, [user, loading, roles, navigate]);

  // Customers can browse before adding an address. AddressPromptSheet asks for one on top of
  // the storefront (dismissible for the session); checkout still requires an address.

  if (pathname === "/customer") return <Navigate to="/customer/home" replace />;

  if (onSetup) return <Outlet />;

  return (
    <StorefrontShell>
      <Outlet />
      <AddressPromptSheet />
    </StorefrontShell>
  );
}
