import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

// Shared query client. Defaults tuned for an EHR usage pattern —
// chart views and dashboards are revisited frequently, so 2 min
// staleTime cuts most needless refetches while WebSocket events
// still force invalidation when something actually changes.
// gcTime stays generous so cross-page navigation hits warm cache.
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60_000,
      gcTime: 10 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: "always",
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status >= 400 && error.status < 500) {
          return false;
        }
        return failureCount < 2;
      },
    },
    mutations: {
      retry: false,
    },
  },
});
