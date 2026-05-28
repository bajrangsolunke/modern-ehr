import { useQuery } from "@tanstack/react-query";
import { labsApi } from "../api/labs-api";

const LABS_KEY = ["patient", "labs"] as const;

export function useLabResults(patientId: string | undefined) {
  return useQuery({
    queryKey: [...LABS_KEY, patientId],
    queryFn: () => labsApi.listForPatient(patientId as string),
    enabled: Boolean(patientId),
    staleTime: 30_000,
  });
}
