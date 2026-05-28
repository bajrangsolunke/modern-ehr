import { useQuery } from "@tanstack/react-query";
import { tasksApi } from "@/features/tasks/api/tasks-api";

export function useTasks() {
  return useQuery({
    queryKey: ["tasks", "me"],
    queryFn: tasksApi.list,
  });
}
