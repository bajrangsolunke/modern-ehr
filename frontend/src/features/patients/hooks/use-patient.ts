import { useQuery } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api/patients-api";
import { QUERY_KEYS } from "@/config/constants";
import { patients as mockPatients } from "@/mocks";

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: id ? QUERY_KEYS.patients.byId(id) : ["patients", "none"],
    queryFn: () => {
      if (!id) throw new Error("patientId required");
      const fallback = mockPatients.find((p) => p.id === id) ?? mockPatients[0];
      return patientsApi.get(id, fallback);
    },
    enabled: Boolean(id),
  });
}
