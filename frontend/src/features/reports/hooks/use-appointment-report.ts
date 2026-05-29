import { useQuery } from "@tanstack/react-query";
import { reportsApi } from "../api/reports-api";
import type { DateRange } from "../components/DateRangeFilter";
import { QUERY_KEYS } from "@/config/constants";

export function useAppointmentReport(range: DateRange, providerId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.reports.appointments(range, providerId),
    queryFn: () => reportsApi.appointments(range, providerId),
    staleTime: 60_000,
  });
}
