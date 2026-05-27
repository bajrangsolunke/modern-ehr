import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  availabilityApi,
  type AvailabilityInput,
  type AvailabilitySlot,
} from "@/features/settings/api/availability-api";
import { toast } from "@/lib/toast";

const key = (userId: string) => ["availability", "user", userId] as const;

/**
 * Fetch a user's availability. Pass "me" to use the /me endpoint.
 */
export function useAvailability(userId: string | undefined) {
  return useQuery({
    queryKey: key(userId ?? "none"),
    queryFn: () => {
      if (!userId) return Promise.resolve<AvailabilitySlot[]>([]);
      return userId === "me"
        ? availabilityApi.forMe()
        : availabilityApi.forUser(userId);
    },
    enabled: Boolean(userId),
    staleTime: 30_000,
  });
}

export function useCreateSlot(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: AvailabilityInput) => {
      if (!userId) throw new Error("Missing user id");
      return availabilityApi.create(userId, input);
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: key(userId) });
      toast.success("Slot added");
    },
    onError: (err) =>
      toast.error("Couldn't add slot", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useUpdateSlot(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      input,
    }: {
      id: string;
      input: Partial<AvailabilityInput>;
    }) => availabilityApi.update(id, input),
    onSettled: () => {
      if (userId) qc.invalidateQueries({ queryKey: key(userId) });
    },
    onError: (err) =>
      toast.error("Couldn't update slot", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useDeleteSlot(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => availabilityApi.remove(id),
    onMutate: async (id) => {
      if (!userId) return;
      await qc.cancelQueries({ queryKey: key(userId) });
      const prev = qc.getQueryData<AvailabilitySlot[]>(key(userId));
      if (prev) {
        qc.setQueryData<AvailabilitySlot[]>(
          key(userId),
          prev.filter((s) => s.id !== id)
        );
      }
      return { prev };
    },
    onError: (err, _id, ctx) => {
      if (userId && ctx?.prev) qc.setQueryData(key(userId), ctx.prev);
      toast.error("Couldn't remove slot", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => {
      if (userId) qc.invalidateQueries({ queryKey: key(userId) });
    },
  });
}
