import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../api/reports-api";
import type { DateRange } from "../components/DateRangeFilter";
import { QUERY_KEYS } from "@/config/constants";

export function useClinicalReport(range: DateRange) {
  return useQuery({
    queryKey: QUERY_KEYS.reports.clinical(range),
    queryFn: () => reportsApi.clinical(range),
    staleTime: 60_000,
  });
}
