import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { tasksApi } from "@/features/tasks/api/tasks-api";
import { toast } from "@/lib/toast";

export function useTasks() {
  return useQuery({
    queryKey: ["tasks", "me"],
    queryFn: tasksApi.list,
  });
}

export function useFormDetail(id: string | null) {
  return useQuery({
    queryKey: ["forms", "me", id],
    queryFn: () => tasksApi.getForm(id as string),
    enabled: Boolean(id),
  });
}

export function useCompleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.complete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", "me"] });
      qc.invalidateQueries({ queryKey: ["notifications", "me"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "me"] });
      toast.success("Task completed");
    },
    onError: (err) =>
      toast.error("Couldn't complete task", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useSubmitForm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Record<string, unknown> }) =>
      tasksApi.submitForm(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks", "me"] });
      qc.invalidateQueries({ queryKey: ["forms", "me"] });
      qc.invalidateQueries({ queryKey: ["notifications", "me"] });
      qc.invalidateQueries({ queryKey: ["dashboard", "me"] });
      toast.success("Form submitted");
    },
    onError: (err) =>
      toast.error("Couldn't submit form", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
