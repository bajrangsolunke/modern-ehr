import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { chargesApi, type ChargeCreateInput } from "../api/charges-api";
import { toast } from "@/lib/toast";

export function useOpenCharges(patientId: string | undefined) {
  return useQuery({
    queryKey: ["billing", "charges", { patientId, openOnly: true }],
    queryFn: () => chargesApi.listForPatient(patientId!, { openOnly: true }),
    enabled: Boolean(patientId),
  });
}

export function useCreateCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChargeCreateInput) => chargesApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing"] });
      toast.success("Charge added");
    },
    onError: (err) =>
      toast.error("Couldn't add charge", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useVoidCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ chargeId, reason }: { chargeId: string; reason: string }) =>
      chargesApi.void(chargeId, reason),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing"] });
      toast.success("Charge voided");
    },
    onError: (err) =>
      toast.error("Couldn't void charge", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
