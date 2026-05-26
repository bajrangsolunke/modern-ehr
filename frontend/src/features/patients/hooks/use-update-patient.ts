import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patientsApi, type PatientInput } from "@/features/patients/api/patients-api";
import { QUERY_KEYS } from "@/config/constants";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";
import type { Patient } from "@/types";

export function useUpdatePatient(id: string | undefined) {
  const qc = useQueryClient();
  const demoModeActive = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: (input: Partial<PatientInput>) => {
      if (!id) throw new Error("Missing patient id");
      if (demoModeActive) {
        // Demo mode: return the prior patient blob with the patch applied
        const prior = qc.getQueryData<Patient>(QUERY_KEYS.patients.byId(id));
        return Promise.resolve({
          ...(prior ?? {
            id,
            mrn: "",
            name: "",
            sex: "O",
            dob: "",
            procedure: "",
            procedureDate: "",
            assignedPhysician: { name: "—" },
            tags: [],
            risk: "low",
            status: "scheduled",
            age: 0,
          }),
          ...prior,
          ...(input.first_name || input.last_name
            ? { name: `${input.first_name ?? ""} ${input.last_name ?? ""}`.trim() }
            : {}),
          ...(input.procedure ? { procedure: input.procedure } : {}),
          ...(input.procedure_date ? { procedureDate: input.procedure_date } : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.risk ? { risk: input.risk } : {}),
          ...(input.tags ? { tags: input.tags } : {}),
        } as Patient);
      }
      return patientsApi.update(id, input);
    },
    onMutate: async (input) => {
      if (!id) return;
      await qc.cancelQueries({ queryKey: QUERY_KEYS.patients.byId(id) });
      const prev = qc.getQueryData<Patient>(QUERY_KEYS.patients.byId(id));
      if (prev) {
        qc.setQueryData<Patient>(QUERY_KEYS.patients.byId(id), {
          ...prev,
          ...(input.first_name || input.last_name
            ? { name: `${input.first_name ?? ""} ${input.last_name ?? ""}`.trim() }
            : {}),
          ...(input.procedure !== undefined ? { procedure: input.procedure ?? "" } : {}),
          ...(input.procedure_date !== undefined
            ? { procedureDate: input.procedure_date ?? "" }
            : {}),
          ...(input.status ? { status: input.status } : {}),
          ...(input.risk ? { risk: input.risk } : {}),
          ...(input.tags ? { tags: input.tags } : {}),
          ...(input.icu_needed !== undefined ? { icu: input.icu_needed } : {}),
        });
      }
      return { prev };
    },
    onError: (err, _input, ctx) => {
      if (id && ctx?.prev) qc.setQueryData(QUERY_KEYS.patients.byId(id), ctx.prev);
      toast.error("Couldn't save patient", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      if (id) qc.invalidateQueries({ queryKey: QUERY_KEYS.patients.byId(id) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.patients.all });
    },
    onSuccess: () =>
      toast.success(demoModeActive ? "Saved (demo only)" : "Patient saved"),
  });
}
