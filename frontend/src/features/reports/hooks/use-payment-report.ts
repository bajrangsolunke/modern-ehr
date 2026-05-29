import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../api/reports-api";
import type { DateRange } from "../components/DateRangeFilter";
import { QUERY_KEYS } from "@/config/constants";

export function usePaymentReport(range: DateRange) {
  return useQuery({
    queryKey: QUERY_KEYS.reports.payments(range),
    queryFn: () => reportsApi.payments(range),
    staleTime: 60_000,
  });
}
