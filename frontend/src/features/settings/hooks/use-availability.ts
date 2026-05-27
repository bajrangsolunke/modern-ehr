import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  availabilityApi,
  type AvailabilityInput,
  type AvailabilitySlot,
  type DayOfWeek,
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

/**
 * Replace the availability on `days` with a single new window
 * (start..end). Used for the quick templates ("9–5 Mon–Fri") and the
 * row-level "Copy hours to…" actions. Atomic from the user's POV:
 * one toast, one cache invalidation. Existing slots on target days
 * are wiped first so the user doesn't end up with duplicates.
 */
export function useApplyHours(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (args: {
      days: DayOfWeek[];
      startTime: string;
      endTime: string;
    }) => {
      if (!userId) throw new Error("Missing user id");
      // Snapshot current slots so we know which to delete.
      const existing =
        qc.getQueryData<AvailabilitySlot[]>(key(userId)) ??
        (await (userId === "me"
          ? availabilityApi.forMe()
          : availabilityApi.forUser(userId)));

      const toDelete = existing.filter((s) => args.days.includes(s.dayOfWeek));
      await Promise.all(toDelete.map((s) => availabilityApi.remove(s.id)));
      await Promise.all(
        args.days.map((d) =>
          availabilityApi.create(userId, {
            day_of_week: d,
            start_time: args.startTime,
            end_time: args.endTime,
            is_active: true,
          })
        )
      );
      return args.days.length;
    },
    onSuccess: (count) => {
      if (userId) qc.invalidateQueries({ queryKey: key(userId) });
      toast.success(
        `Hours applied to ${count} ${count === 1 ? "day" : "days"}`
      );
    },
    onError: (err) => {
      if (userId) qc.invalidateQueries({ queryKey: key(userId) });
      toast.error("Couldn't apply hours", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });
}

/**
 * Wipe every availability slot for the user. Same pattern as
 * useApplyHours — atomic toast + invalidation.
 */
export function useClearAllHours(userId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error("Missing user id");
      const existing =
        qc.getQueryData<AvailabilitySlot[]>(key(userId)) ??
        (await (userId === "me"
          ? availabilityApi.forMe()
          : availabilityApi.forUser(userId)));
      await Promise.all(existing.map((s) => availabilityApi.remove(s.id)));
    },
    onSuccess: () => {
      if (userId) qc.invalidateQueries({ queryKey: key(userId) });
      toast.success("All hours cleared");
    },
    onError: (err) =>
      toast.error("Couldn't clear hours", {
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
