import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  authApi,
  type PasswordChangeInput,
  type SelfUpdateInput,
} from "@/features/auth/api/auth-api";
import { QUERY_KEYS } from "@/config/constants";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";

export function useUpdateSelf() {
  const qc = useQueryClient();
  const setUser = useAuthStore((s) => s.setUser);
  return useMutation({
    mutationFn: (input: SelfUpdateInput) => authApi.updateMe(input),
    onSuccess: (user) => {
      setUser(user);
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me });
      toast.success("Profile updated");
    },
    onError: (err) =>
      toast.error("Couldn't update profile", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useChangePassword() {
  return useMutation({
    mutationFn: (input: PasswordChangeInput) => authApi.changePassword(input),
    onSuccess: () => toast.success("Password updated"),
    onError: (err) =>
      toast.error("Couldn't change password", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
