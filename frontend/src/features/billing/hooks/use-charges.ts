import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  chargesApi,
  type Charge,
  type ChargeCreateInput,
} from "../api/charges-api";
import { toast } from "@/lib/toast";

export function useCreateCharge() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChargeCreateInput) => chargesApi.create(input),
    onSuccess: (charge) => {
      qc.invalidateQueries({ queryKey: ["billing"] });
      // Append to the local "open charges this session" list.
      qc.setQueryData<Charge[]>(
        ["billing", "openCharges-local"],
        (prev) => [...(prev ?? []), charge],
      );
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
