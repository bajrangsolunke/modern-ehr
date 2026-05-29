import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  invoicesApi,
  type InvoiceIssueInput,
} from "../api/invoices-api";
import { toast } from "@/lib/toast";

export function usePatientInvoices(patientId: string | undefined) {
  return useQuery({
    queryKey: ["billing", "invoices", { patientId }],
    queryFn: () => invoicesApi.listForPatient(patientId!),
    enabled: Boolean(patientId),
  });
}

export function useIssueInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: InvoiceIssueInput) => invoicesApi.issue(input),
    onSuccess: (inv) => {
      qc.invalidateQueries({ queryKey: ["billing"] });
      qc.setQueryData(["billing", "openCharges-local"], []);
      toast.success(`Invoice ${inv.number} issued`);
    },
    onError: (err) =>
      toast.error("Couldn't issue invoice", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
