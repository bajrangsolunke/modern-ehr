import { useMutation } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api/patients-api";
import { toast } from "@/lib/toast";

export function usePortalInvite() {
  return useMutation({
    mutationFn: (patientId: string) => patientsApi.invitePortal(patientId),
    onError: (err) =>
      toast.error("Couldn't generate invite", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
