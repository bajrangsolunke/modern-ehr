/**
 * Provider/admin dashboard snapshot — feeds the right-rail Requested
 * Tasks + Messages notification cards. Refreshes every 60s so the
 * counts stay roughly live without us wiring a websocket here.
 */
import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "../api/dashboard-api";

const KEY = ["dashboard", "snapshot"] as const;

export function useDashboard() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => dashboardApi.snapshot(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
