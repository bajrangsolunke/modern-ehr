import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { authApi, type LoginPayload } from "@/features/auth/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { QUERY_KEYS } from "@/config/constants";
import { currentUser as mockCurrentUser } from "@/mocks";
import { env } from "@/config/env";

export function useLogin() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const setDemoMode = useAuthStore((s) => s.setDemoMode);
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      try {
        const res = await authApi.login(payload);
        return { kind: "real" as const, res };
      } catch (err) {
        // Connectivity failure with demo fallback enabled => fake login.
        if (env.DEMO_FALLBACK && err instanceof TypeError) {
          return { kind: "demo" as const };
        }
        throw err;
      }
    },
    onSuccess: (result) => {
      if (result.kind === "demo") {
        setDemoMode(true);
        setUser(mockCurrentUser);
      } else {
        setTokens({ access: result.res.access_token, refresh: result.res.refresh_token });
      }
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me });
      const from = (location.state as { from?: { pathname: string } } | null)?.from
        ?.pathname;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    },
  });
}
