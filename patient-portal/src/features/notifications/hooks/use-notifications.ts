import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/features/notifications/api/notifications-api";

export function useNotifications() {
  return useQuery({
    queryKey: ["notifications", "me"],
    queryFn: notificationsApi.list,
  });
}
