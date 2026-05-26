import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { authApi } from "@/features/auth/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { QUERY_KEYS } from "@/config/constants";
import { currentUser as mockCurrentUser } from "@/mocks";

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const demoModeActive = useAuthStore((s) => s.demoModeActive);

  const query = useQuery({
    queryKey: QUERY_KEYS.auth.me,
    queryFn: () => authApi.me(() => mockCurrentUser),
    enabled: Boolean(accessToken) || demoModeActive,
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  return query;
}
