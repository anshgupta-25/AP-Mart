import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  Link,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect } from "react";

import appCss from "../styles.css?url";
import apmartLogoSmall from "@/assets/apmart-logo-192.png";
import { AuthProvider } from "@/hooks/useAuth";
import { Layout } from "@/components/Layout";
import { supabase } from "@/integrations/supabase/client";



function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <h2 className="mt-4 text-xl font-semibold">Page not found</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-xl gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Back to AP Mart
          </Link>
        </div>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">This page didn't load</h1>
        <p className="mt-2 text-sm text-muted-foreground">{error.message}</p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="rounded-xl gradient-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            Try again
          </button>
          <a href="/" className="rounded-xl border border-input px-4 py-2 text-sm font-medium">Go home</a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { title: "AP Mart — Groceries from shops near you" },
      { name: "description", content: "Order groceries, snacks and daily essentials from trusted local shops near you." },
      { name: "theme-color", content: "#A3E635" },
      { property: "og:title", content: "AP Mart — Groceries from local shops" },
      { property: "og:description", content: "Fresh groceries and household essentials from independent shops in your neighbourhood." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "preload", as: "image", href: apmartLogoSmall },
      { rel: "icon", type: "image/png", href: "/favicon.png" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "" },
      // Warm the DNS + TLS handshake for the backend before the first query runs.
      { rel: "preconnect", href: import.meta.env.VITE_SUPABASE_URL as string, crossOrigin: "" },
      { rel: "dns-prefetch", href: import.meta.env.VITE_SUPABASE_URL as string },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap",
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  // Coordinate auth transitions with the router + query cache exactly once.
  // Filtered so hourly TOKEN_REFRESHED / INITIAL_SESSION events don't
  // trigger a cache-wide refetch storm.
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_OUT") {
        // Drop protected data so no stale query hits the API without a token.
        queryClient.clear();
      } else {
        queryClient.invalidateQueries();
      }
      router.invalidate();
    });
    return () => subscription.unsubscribe();
  }, [queryClient, router]);

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Layout />
      </AuthProvider>
    </QueryClientProvider>
  );
}

