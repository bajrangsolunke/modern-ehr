import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { authApi } from "@/features/auth/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { QUERY_KEYS } from "@/config/constants";

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setMe = useAuthStore((s) => s.setMe);

  const query = useQuery({
    queryKey: QUERY_KEYS.auth.me,
    queryFn: authApi.me,
    enabled: Boolean(accessToken),
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (query.data) setMe(query.data);
  }, [query.data, setMe]);

  return query;
}
