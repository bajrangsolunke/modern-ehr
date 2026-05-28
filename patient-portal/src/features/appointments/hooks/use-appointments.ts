import { useQuery } from "@tanstack/react-query";
import { appointmentsApi } from "@/features/appointments/api/appointments-api";

export function useAppointments() {
  return useQuery({
    queryKey: ["appointments", "me"],
    queryFn: appointmentsApi.list,
  });
}
