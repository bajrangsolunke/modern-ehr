import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  usersApi,
  type AppUser,
  type UserCreateInput,
  type UserFilters,
  type UserPage,
  type UserUpdateInput,
} from "@/features/users/api/users-api";
import { QUERY_KEYS } from "@/config/constants";
import { toast } from "@/lib/toast";

export function useUsers(
  filters: UserFilters,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: QUERY_KEYS.users.list(filters),
    queryFn: () => usersApi.list(filters),
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });
}

/** Drop-in replacement for useUsers when the caller only needs an
 *  assignee picker — hits /users/assignable so non-admin providers
 *  can still see their teammates. */
export function useAssignableUsers(
  filters: Pick<UserFilters, "q" | "role" | "page" | "page_size">,
  options?: { enabled?: boolean }
) {
  return useQuery({
    queryKey: ["users", "assignable", filters],
    queryFn: () => usersApi.listAssignable(filters),
    staleTime: 30_000,
    enabled: options?.enabled ?? true,
  });
}

export function useUser(id: string | undefined) {
  return useQuery({
    queryKey: QUERY_KEYS.users.byId(id ?? "none"),
    queryFn: () => usersApi.get(id as string),
    enabled: Boolean(id),
  });
}

export function useUserStats(id: string | undefined) {
  return useQuery({
    queryKey: [...QUERY_KEYS.users.byId(id ?? "none"), "stats"],
    queryFn: () => usersApi.stats(id as string),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useUserAppointments(id: string | undefined, limit = 20) {
  return useQuery({
    queryKey: [...QUERY_KEYS.users.byId(id ?? "none"), "appointments", limit],
    queryFn: () => usersApi.appointments(id as string, limit),
    enabled: Boolean(id),
    staleTime: 30_000,
  });
}

export function useCreateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UserCreateInput) => usersApi.create(input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: QUERY_KEYS.users.all });
      toast.success("User created");
    },
    onError: (err) =>
      toast.error("Couldn't create user", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useUpdateUser(id: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UserUpdateInput) => {
      if (!id) throw new Error("Missing user id");
      return usersApi.update(id, input);
    },
    onMutate: async (input) => {
      if (!id) return;
      await qc.cancelQueries({ queryKey: QUERY_KEYS.users.all });
      // Optimistic patch on each cached list page that contains this user.
      const queries = qc.getQueriesData<UserPage>({
        queryKey: QUERY_KEYS.users.all,
      });
      const snapshots: Array<[readonly unknown[], UserPage | undefined]> = [];
      for (const [key, page] of queries) {
        snapshots.push([key, page]);
        if (!page) continue;
        const next = {
          ...page,
          items: page.items.map((u) =>
            u.id === id
              ? ({
                  ...u,
                  ...(input.full_name !== undefined ? { fullName: input.full_name } : {}),
                  ...(input.role !== undefined ? { role: input.role } : {}),
                  ...(input.specialty !== undefined
                    ? { specialty: input.specialty ?? null }
                    : {}),
                  ...(input.is_active !== undefined ? { isActive: input.is_active } : {}),
                } satisfies AppUser)
              : u
          ),
        };
        qc.setQueryData(key, next);
      }
      return { snapshots };
    },
    onError: (err, _input, ctx) => {
      for (const [key, prev] of ctx?.snapshots ?? []) {
        qc.setQueryData(key, prev);
      }
      toast.error("Couldn't update user", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.users.all }),
    onSuccess: () => toast.success("User updated"),
  });
}

export function useDeactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.deactivate(id),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.users.all }),
    onSuccess: () => toast.success("User deactivated"),
    onError: (err) =>
      toast.error("Couldn't deactivate user", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useInviteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (userId: string) => usersApi.invite(userId),
    onSuccess: (data) => {
      // Invalidate so any invite-status badge refreshes.
      qc.invalidateQueries({ queryKey: QUERY_KEYS.users.all });
      if (data.emailQueued) {
        toast.success("Invite sent", {
          description: "The setup link was emailed to the user.",
        });
      } else {
        toast.success("Invite URL ready", {
          description: "Copy and share the link manually (SMTP not configured).",
        });
      }
    },
    onError: (err) =>
      toast.error("Couldn't generate invite", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

/** Convenience hook for row-level reactivation — doesn't need a fixed id. */
export function useReactivateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => usersApi.update(id, { is_active: true }),
    onSettled: () => qc.invalidateQueries({ queryKey: QUERY_KEYS.users.all }),
    onSuccess: () => toast.success("User reactivated"),
    onError: (err) =>
      toast.error("Couldn't reactivate user", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
