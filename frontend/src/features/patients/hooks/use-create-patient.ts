import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patientsApi, type PatientInput } from "@/features/patients/api/patients-api";
import { QUERY_KEYS } from "@/config/constants";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";

export function useCreatePatient() {
  const qc = useQueryClient();
  const demoModeActive = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: (input: PatientInput) => {
      if (demoModeActive) {
        // Demo mode: short-circuit, fake success
        return Promise.resolve({
          id: `demo-${Date.now()}`,
          mrn: input.mrn ?? "",
          name: `${input.first_name ?? ""} ${input.last_name ?? ""}`.trim(),
          sex: input.sex ?? "O",
          dob: input.dob ?? "",
          procedure: input.procedure ?? "",
          procedureDate: input.procedure_date ?? "",
          assignedPhysician: { name: "—" },
          tags: input.tags ?? [],
          risk: input.risk ?? "low",
          status: input.status ?? "scheduled",
          age: 0,
          city: input.city ?? undefined,
          asa: input.asa ?? undefined,
          icu: input.icu_needed ?? false,
        });
      }
      return patientsApi.create(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.patients.all });
      toast.success(
        demoModeActive ? "Patient added (demo only)" : "Patient added"
      );
    },
    onError: (err) =>
      toast.error("Couldn't add patient", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
