import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  tasksApi,
  type Task,
  type TaskFilters,
  type TaskInput,
  type TaskUpdate,
} from "../api/tasks-api";
import { toast } from "@/lib/toast";

const TASKS_KEY = ["tasks"] as const;

export function useTasks(filters: TaskFilters) {
  return useQuery({
    queryKey: [...TASKS_KEY, "list", filters],
    queryFn: () => tasksApi.list(filters),
    staleTime: 30_000,
  });
}

export function useTask(id: string | undefined) {
  return useQuery({
    queryKey: [...TASKS_KEY, "byId", id],
    queryFn: () => tasksApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useCreateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: TaskInput) => tasksApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
      toast.success("Task created");
    },
    onError: (err) =>
      toast.error("Couldn't create task", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, input }: { id: string; input: TaskUpdate }) =>
      tasksApi.update(id, input),
    onMutate: async ({ id, input }) => {
      await qc.cancelQueries({ queryKey: TASKS_KEY });
      const snapshots: Array<[readonly unknown[], unknown]> = [];
      // Optimistic patch — flip status/priority badges before the
      // round-trip completes.
      const lists = qc.getQueriesData<{ items: Task[] }>({
        queryKey: [...TASKS_KEY, "list"],
      });
      for (const [key, page] of lists) {
        snapshots.push([key, page]);
        if (!page) continue;
        qc.setQueryData(key, {
          ...page,
          items: page.items.map((t) =>
            t.id === id ? { ...t, ...mapOptimistic(input) } : t
          ),
        });
      }
      return { snapshots };
    },
    onError: (err, _vars, ctx) => {
      for (const [key, prev] of ctx?.snapshots ?? []) {
        qc.setQueryData(key, prev);
      }
      toast.error("Couldn't update task", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: TASKS_KEY }),
  });
}

export function useDeleteTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => tasksApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TASKS_KEY });
      toast.success("Task deleted");
    },
    onError: (err) =>
      toast.error("Couldn't delete task", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

/** Map a partial TaskUpdate to fields on the cached Task row. The
 *  optimistic patch only flips simple scalars; the server still owns
 *  derived fields like updated_at / completed_at. */
function mapOptimistic(input: TaskUpdate): Partial<Task> {
  const out: Partial<Task> = {};
  if (input.title !== undefined) out.title = input.title;
  if (input.description !== undefined) out.description = input.description;
  if (input.category !== undefined) out.category = input.category;
  if (input.priority !== undefined) out.priority = input.priority;
  if (input.status !== undefined) out.status = input.status;
  if (input.due_date !== undefined) out.dueDate = input.due_date;
  return out;
}
