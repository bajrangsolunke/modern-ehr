/**
 * Subscribes to the global /ws channel so new messages from the
 * server invalidate the React Query cache in real time. The backend
 * fans out messages with `type: "message.created"` to every
 * participant on each conversation write — we just listen and
 * invalidate.
 *
 * Reconnect logic: exponential backoff capped at ~15s. The WS endpoint
 * authenticates via the access token in a query param.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { env } from "@/config/env";
import { STORAGE_KEYS } from "@/config/constants";
import { messagesQueryKey } from "./use-messages";
import { useTypingStore } from "../stores/typing-store";
import {
  NOTIFICATIONS_KEY,
  UNREAD_COUNT_KEY,
} from "@/features/notifications/hooks/use-notifications";
import type { AppNotification } from "@/features/notifications/api/notifications-api";
import { toast } from "@/lib/toast";

interface WsEnvelope {
  type: string;
  conversation_id?: string;
  user_id?: string;
  notification?: BackendNotificationDto;
  [key: string]: unknown;
}

interface BackendNotificationDto {
  id: string;
  kind: AppNotification["kind"];
  urgency: AppNotification["urgency"];
  title: string;
  body: string | null;
  related_type: string | null;
  related_id: string | null;
  link: string | null;
  created_at: string;
  is_read: boolean;
}

export function useMessagesSocket() {
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectRef = useRef<number>(0);
  const closingRef = useRef<boolean>(false);

  useEffect(() => {
    closingRef.current = false;

    const connect = () => {
      const token = localStorage.getItem(STORAGE_KEYS.accessToken);
      if (!token) {
        // Not signed in yet — try again in a bit; auth-store will
        // re-render this hook's parent on login.
        scheduleReconnect();
        return;
      }
      const url = `${env.WS_URL}?token=${encodeURIComponent(token)}`;
      const ws = new WebSocket(url);
      wsRef.current = ws;

      ws.onopen = () => {
        reconnectRef.current = 0;
      };

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data) as WsEnvelope;
          if (
            payload.type === "message.created" ||
            payload.type === "conversation.read"
          ) {
            qc.invalidateQueries({ queryKey: messagesQueryKey });
            if (payload.conversation_id) {
              qc.invalidateQueries({
                queryKey: [...messagesQueryKey, "byId", payload.conversation_id],
              });
            }
          } else if (payload.type === "conversation.typing") {
            if (payload.conversation_id && payload.user_id) {
              useTypingStore
                .getState()
                .recordTyping(payload.conversation_id, payload.user_id);
            }
          } else if (
            payload.type === "notification.created" &&
            payload.notification
          ) {
            handleNotification(payload.notification, qc);
          }
        } catch {
          /* ignore non-JSON frames (e.g. server echoes) */
        }
      };

      ws.onclose = () => {
        if (!closingRef.current) scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    function handleNotification(
      dto: BackendNotificationDto,
      queryClient: ReturnType<typeof useQueryClient>,
    ) {
      // Optimistically prepend to the cached list so the drawer ticks
      // before the refetch comes back. Refetch still runs to reconcile
      // any concurrent writes we missed.
      queryClient.setQueriesData<AppNotification[] | undefined>(
        { queryKey: NOTIFICATIONS_KEY },
        (prev) => {
          if (!prev) return prev;
          if (prev.some((n) => n.id === dto.id)) return prev;
          const next: AppNotification = {
            id: dto.id,
            userId: "",
            title: dto.title,
            body: dto.body,
            kind: dto.kind,
            urgency: dto.urgency,
            relatedType: dto.related_type,
            relatedId: dto.related_id,
            link: dto.link,
            isRead: dto.is_read,
            createdAt: dto.created_at,
          };
          return [next, ...prev];
        },
      );
      queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_KEY });
      queryClient.invalidateQueries({ queryKey: UNREAD_COUNT_KEY });

      // High/critical urgency fires an OS-level toast when the tab is
      // hidden — so a provider on another tab still sees a critical
      // lab. Skip if the user hasn't granted permission yet (we ask
      // once on the Topbar bell mount).
      const wantsOsToast =
        dto.urgency === "critical" || dto.urgency === "high";
      if (
        wantsOsToast &&
        typeof document !== "undefined" &&
        document.hidden &&
        typeof Notification !== "undefined" &&
        Notification.permission === "granted"
      ) {
        try {
          new Notification(dto.title, {
            body: dto.body ?? undefined,
            tag: dto.id,
          });
        } catch {
          /* ignored — some browsers throw if iframed */
        }
      }

      // Always pop an in-app toast too — covers the foreground case
      // and works even without OS permission.
      const toastFn =
        dto.urgency === "critical"
          ? toast.error
          : dto.urgency === "high"
            ? toast.warning
            : toast.info;
      toastFn(dto.title, { description: dto.body ?? undefined });
    }

    const scheduleReconnect = () => {
      const attempts = reconnectRef.current;
      reconnectRef.current = attempts + 1;
      const delay = Math.min(15_000, 500 * 2 ** Math.min(attempts, 5));
      window.setTimeout(() => {
        if (!closingRef.current) connect();
      }, delay);
    };

    connect();

    return () => {
      closingRef.current = true;
      wsRef.current?.close();
      wsRef.current = null;
    };
  }, [qc]);
}
