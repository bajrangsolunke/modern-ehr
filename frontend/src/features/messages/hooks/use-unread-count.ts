/**
 * Sums unread across the viewer's conversations. Drives the badge on
 * the Communication nav item. Light polling fallback (60s) in case the
 * WebSocket missed an invalidation — the actual cache invalidation
 * still happens in useMessagesSocket.
 */
import { useQuery } from "@tanstack/react-query";
import { messagesApi } from "../api/messages-api";

const KEY = ["messages", "list", { audience: "all" }] as const;

export function useUnreadCount(): number {
  const { data = [] } = useQuery({
    queryKey: KEY,
    queryFn: () => messagesApi.listConversations({}),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
  return data.reduce((sum, c) => sum + (c.unread || 0), 0);
}
