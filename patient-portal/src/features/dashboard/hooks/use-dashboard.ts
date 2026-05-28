import { useQuery } from "@tanstack/react-query";
import { dashboardApi } from "@/features/dashboard/api/dashboard-api";
import { QUERY_KEYS } from "@/config/constants";

export function useDashboard() {
  return useQuery({
    queryKey: QUERY_KEYS.dashboard.me,
    queryFn: dashboardApi.get,
  });
}
