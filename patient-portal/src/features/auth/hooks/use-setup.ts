import { useMutation, useQuery } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";

export function useSetupVerify(token: string | null) {
  return useQuery({
    queryKey: ["setup-verify", token],
    queryFn: () => authApi.setupVerify(token as string),
    enabled: Boolean(token),
    retry: false,
  });
}

export function useSetup() {
  const setTokens = useAuthStore((s) => s.setTokens);
  return useMutation({
    mutationFn: (input: { token: string; password: string }) =>
      authApi.setup(input),
    onSuccess: (tokens) => {
      setTokens({
        access: tokens.access_token,
        refresh: tokens.refresh_token,
      });
      toast.success("Welcome! Your account is ready.");
    },
    onError: (err) =>
      toast.error("Couldn't set password", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
