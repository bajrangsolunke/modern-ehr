/**
 * Subscribes to the global /ws channel so new messages from the
 * server invalidate the React Query cache in real time. The backend
 * fans out `message.created` to every conversation subscriber
 * (including the patient_id for patient-audience threads) — we just
 * listen and invalidate.
 *
 * Reconnect logic: exponential backoff capped at ~15s. The WS
 * endpoint authenticates via the access token in a query param.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { env } from "@/config/env";
import { STORAGE_KEYS } from "@/config/constants";

interface WsEnvelope {
  type: string;
  conversation_id?: string;
  [key: string]: unknown;
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
            qc.invalidateQueries({ queryKey: ["conversations", "me"] });
            if (payload.conversation_id) {
              qc.invalidateQueries({
                queryKey: ["conversations", "me", payload.conversation_id],
              });
            }
            // Bump the notifications + dashboard feeds since both
            // surface new-message events.
            qc.invalidateQueries({ queryKey: ["notifications", "me"] });
            qc.invalidateQueries({ queryKey: ["dashboard", "me"] });
          }
        } catch {
          /* ignore non-JSON frames */
        }
      };

      ws.onclose = () => {
        if (!closingRef.current) scheduleReconnect();
      };

      ws.onerror = () => {
        ws.close();
      };
    };

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
