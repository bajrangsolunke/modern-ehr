import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { paymentsApi, type CashPaymentInput } from "../api/payments-api";
import { toast } from "@/lib/toast";

export function useInvoicePayments(invoiceId: string | undefined) {
  return useQuery({
    queryKey: ["billing", "payments", { invoiceId }],
    queryFn: () => paymentsApi.listForInvoice(invoiceId!),
    enabled: Boolean(invoiceId),
  });
}

export function useRecordCash() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: CashPaymentInput) => paymentsApi.recordCash(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing"] });
      toast.success("Cash payment recorded");
    },
    onError: (err) =>
      toast.error("Couldn't record payment", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
