import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./api-client";

// Patient portal sees less churn than the provider portal — patients
// mostly read. 2 min staleTime + 10 min gcTime means tab switches
// hit warm cache. WS invalidations still kick in immediately when a
// new message lands, so the UI feels live without polling.
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
