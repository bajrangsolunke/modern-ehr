import { useQuery } from "@tanstack/react-query";
import { appointmentsApi } from "@/features/appointments/api/appointments-api";
import { QUERY_KEYS } from "@/config/constants";
import { appointments as mockAppointments } from "@/mocks";

export function useUpcomingAppointments(limit = 50) {
  return useQuery({
    queryKey: QUERY_KEYS.appointments.upcoming,
    queryFn: () => appointmentsApi.listUpcoming(limit, mockAppointments),
    staleTime: 60_000,
  });
}
