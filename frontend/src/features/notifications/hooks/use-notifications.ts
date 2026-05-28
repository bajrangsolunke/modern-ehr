/**
 * Notifications feed + unread count hooks. WS invalidations (in
 * `useNotificationsSocket`) keep both fresh in real time; the polling
 * interval is a fallback for when the socket is down.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { notificationsApi } from "../api/notifications-api";

export const NOTIFICATIONS_KEY = ["notifications"] as const;
export const UNREAD_COUNT_KEY = ["notifications", "unread-count"] as const;

export function useNotifications(onlyUnread = false) {
  return useQuery({
    queryKey: [...NOTIFICATIONS_KEY, { onlyUnread }],
    queryFn: () => notificationsApi.list(onlyUnread),
    staleTime: 15_000,
  });
}

export function useUnreadNotificationCount(): number {
  const { data = 0 } = useQuery({
    queryKey: UNREAD_COUNT_KEY,
    queryFn: () => notificationsApi.unreadCount(),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return data;
}

export function useMarkNotificationRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => notificationsApi.markRead(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => notificationsApi.readAll(),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      qc.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });
    },
  });
}
