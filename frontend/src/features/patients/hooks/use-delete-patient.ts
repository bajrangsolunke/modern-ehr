import { useMutation, useQueryClient } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api/patients-api";
import { QUERY_KEYS } from "@/config/constants";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";

export function useDeletePatient() {
  const qc = useQueryClient();
  const demoModeActive = useAuthStore((s) => s.demoModeActive);

  return useMutation({
    mutationFn: (id: string) => {
      if (demoModeActive) return Promise.resolve();
      return patientsApi.remove(id);
    },
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: QUERY_KEYS.patients.byId(id) });
      qc.invalidateQueries({ queryKey: QUERY_KEYS.patients.all });
      toast.success(
        demoModeActive ? "Patient removed (demo only)" : "Patient removed"
      );
    },
    onError: (err) =>
      toast.error("Couldn't remove patient", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
