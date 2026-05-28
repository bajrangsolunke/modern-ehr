import { useMutation } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api/auth-api";
import { toast } from "@/lib/toast";

export function useRequestReset() {
  return useMutation({
    mutationFn: (email: string) => authApi.requestReset(email),
    onSuccess: () => {
      toast.success("If that email is on file, a reset link is on its way.");
    },
  });
}
