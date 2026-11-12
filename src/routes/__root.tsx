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
import { Capacitor } from "@capacitor/core";



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
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "AP Mart — Groceries delivered at lightning speed" },
      { name: "description", content: "AP Mart delivers groceries, snacks and essentials to your door in 10 minutes." },
      { name: "theme-color", content: "#A3E635" },
      { property: "og:title", content: "AP Mart — Groceries in 10 minutes" },
      { property: "og:description", content: "Fresh groceries, snacks and household essentials at your door in minutes." },
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
        href: "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@500;700;800&family=Plus+Jakarta+Sans:wght@400;500;600;700&display=swap",
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

  // Android app: lets CSS drop effects the WebView renders slowly (see styles.css).
  useEffect(() => {
    if (Capacitor.isNativePlatform()) document.documentElement.classList.add("native-app");
  }, []);

  // Android app: deep links (com.apmart.app://auth/callback#access_token=…) from the
  // system-browser Google sign-in. Close the browser and open the path in-app.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    (async () => {
      const [{ App }, { Browser }] = await Promise.all([import("@capacitor/app"), import("@capacitor/browser")]);
      const handle = await App.addListener("appUrlOpen", async ({ url }) => {
        if (!url.startsWith("com.apmart.app://")) return;
        Browser.close().catch(() => {});
        // e.g. auth/callback#access_token=…&refresh_token=… (or ?error=…)
        const rest = url.slice("com.apmart.app://".length);
        const hashAt = rest.indexOf("#");
        const path = "/" + (hashAt >= 0 ? rest.slice(0, hashAt) : rest);
        const hash = new URLSearchParams(hashAt >= 0 ? rest.slice(hashAt + 1) : "");
        const access_token = hash.get("access_token");
        const refresh_token = hash.get("refresh_token");
        if (access_token && refresh_token) {
          await supabase.auth.setSession({ access_token, refresh_token });
        }
        // The callback page finishes sign-in (profile sync, role redirect) or shows errors.
        router.history.push(hash.get("error") ? `${path}#${hash.toString()}` : path);
      });
      remove = () => handle.remove();
    })();
    return () => remove?.();
  }, [router]);

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

