import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../api/reports-api";
import type { DateRange } from "../components/DateRangeFilter";
import { QUERY_KEYS } from "@/config/constants";

export function useProductivityReport(range: DateRange, providerId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.reports.productivity(range, providerId),
    queryFn: () => reportsApi.productivity(range, providerId),
    staleTime: 60_000,
  });
}
