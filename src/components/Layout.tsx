import { Outlet, useRouterState } from "@tanstack/react-router";
import { StorefrontShell } from "./shell/StorefrontShell";
import { Toaster } from "./ui/sonner";
import { useNotifications } from "@/hooks/useNotifications";

// Paths that render their own chrome (portals, auth screens) or none at all.
const OWN_CHROME_PREFIXES = [
  "/customer",
  "/shopkeeper",
  "/delivery",
  "/admin",
  "/login",
  "/signup",
  "/app",
  "/support",
  "/staff-login",
  "/super-admin",
  "/superadmin",
  "/reset-password",
  "/auth",
];

function PublicFooter() {
  return (
    <footer className="hidden border-t border-border bg-card md:block">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5 text-xs text-muted-foreground">
        <div>© {new Date().getFullYear()} AP Mart. Groceries from shops near you.</div>
      </div>
    </footer>
  );
}

export function Layout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  useNotifications();
  const ownChrome = OWN_CHROME_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));

  if (ownChrome) {
    return (
      <div className="min-h-screen flex flex-col">
        <Outlet />
        <Toaster richColors closeButton position="top-center" />
      </div>
    );
  }

  const checkout = pathname === "/checkout" || pathname.startsWith("/checkout/");
  return (
    <>
      <StorefrontShell hideTabs={checkout} footer={<PublicFooter />}>
        <Outlet />
      </StorefrontShell>
      <Toaster richColors closeButton position="top-center" />
    </>
  );
}
