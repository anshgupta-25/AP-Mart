import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        // Data stays fresh for 30s → no wasteful refetch on every mount/nav.
        staleTime: 30_000,
        // Keep unused cache for 5 min so back-nav is instant.
        gcTime: 5 * 60_000,
        // Refocus refetch is noisy on mobile PWAs; realtime already covers freshness.
        refetchOnWindowFocus: false,
        // Retry once on transient failures (network blip, brief 401 during token refresh).
        retry: 1,
      },
      mutations: { retry: 0 },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    // Let Query own freshness so the router preload cache doesn't hide stale data.
    defaultPreloadStaleTime: 0,
    defaultPreload: "intent",
  });

  return router;
};

