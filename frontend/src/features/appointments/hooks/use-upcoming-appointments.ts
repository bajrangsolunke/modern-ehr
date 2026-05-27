import { useQuery } from "@tanstack/react-query";
import { appointmentsApi } from "@/features/appointments/api/appointments-api";
import { QUERY_KEYS } from "@/config/constants";

/** Live-data hook used by the dashboard's upcoming-appointments card. */
export function useUpcomingAppointments(limit = 8) {
  return useQuery({
    queryKey: [...QUERY_KEYS.appointments.upcoming, limit],
    queryFn: () => appointmentsApi.listUpcoming(limit),
    staleTime: 60_000,
  });
}
