import { useQuery, useQueryClient } from "@tanstack/react-query";
import { billingApi } from "../api/billing-api";

export function useInvoices() {
  return useQuery({
    queryKey: ["billing", "invoices"],
    queryFn: () => billingApi.list(),
  });
}

export function useInvoice(id: string | undefined) {
  return useQuery({
    queryKey: ["billing", "invoice", id],
    queryFn: () => billingApi.get(id!),
    enabled: Boolean(id),
  });
}

export function useInvalidateInvoices() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: ["billing"] });
}
