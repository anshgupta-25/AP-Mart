import { createFileRoute, Navigate, Outlet, useNavigate, useRouterState } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { StorefrontShell } from "@/components/shell/StorefrontShell";
import { useCustomerCatalogRealtime } from "@/hooks/useCustomerProducts";
import { useDeliveryContext } from "@/hooks/useDeliveryContext";

export const Route = createFileRoute("/customer")({
  head: () => ({ meta: [{ title: "AP Mart — Groceries from shops near you" }] }),
  component: CustomerShell,
});

function CustomerShell() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, loading, roles } = useAuth() as any;
  const navigate = useNavigate();
  const { hasAddress, ready: addressReady } = useDeliveryContext();
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

  // Every customer must have a default delivery address before browsing —
  // this also covers accounts created by an admin via role assignment.
  useEffect(() => {
    if (loading || !user || onSetup) return;
    if (addressReady && !hasAddress) {
      navigate({
        to: "/customer/address-setup",
        search: { next: pathname } as never,
        replace: true,
      });
    }
  }, [loading, user, onSetup, addressReady, hasAddress, navigate, pathname]);

  if (pathname === "/customer") return <Navigate to="/customer/home" replace />;

  if (onSetup) return <Outlet />;

  return (
    <StorefrontShell>
      <Outlet />
    </StorefrontShell>
  );
}
