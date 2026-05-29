import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  servicesApi,
  type ServiceCreateInput,
  type ServiceUpdateInput,
} from "@/features/billing/api/services-api";
import { toast } from "@/lib/toast";

export function useServices(activeOnly = true) {
  return useQuery({
    queryKey: ["billing", "services", { activeOnly }],
    queryFn: () => servicesApi.list({ active_only: activeOnly }),
  });
}

export function useCreateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceCreateInput) => servicesApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing", "services"] });
      toast.success("Service added");
    },
    onError: (err) =>
      toast.error("Couldn't add service", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useUpdateService(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ServiceUpdateInput) => servicesApi.update(id, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing", "services"] });
      toast.success("Service updated");
    },
    onError: (err) =>
      toast.error("Couldn't update service", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useDeactivateService() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => servicesApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["billing", "services"] });
      toast.success("Service deactivated");
    },
    onError: (err) =>
      toast.error("Couldn't deactivate service", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
