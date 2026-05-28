import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";

export function useLogin() {
  const setTokens = useAuthStore((s) => s.setTokens);
  return useMutation({
    mutationFn: (input: { email: string; password: string }) =>
      authApi.login(input),
    onSuccess: (tokens) => {
      setTokens({
        access: tokens.access_token,
        refresh: tokens.refresh_token,
      });
    },
    onError: (err) =>
      toast.error("Couldn't sign in", {
        description:
          err instanceof Error ? err.message : "Check your email and password.",
      }),
  });
}
