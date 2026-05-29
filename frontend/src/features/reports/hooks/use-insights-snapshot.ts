import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../api/reports-api";
import { QUERY_KEYS } from "@/config/constants";

export function useInsightsSnapshot() {
  return useQuery({
    queryKey: QUERY_KEYS.reports.insights,
    queryFn: () => reportsApi.insights(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
