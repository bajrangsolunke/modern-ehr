import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/features/auth/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { useEffect } from "react";

export function useMe() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setMe = useAuthStore((s) => s.setMe);
  const query = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    enabled: Boolean(accessToken),
    retry: false,
  });
  useEffect(() => {
    if (query.data) setMe(query.data);
  }, [query.data, setMe]);
  return query;
}
