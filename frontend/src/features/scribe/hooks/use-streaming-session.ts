/**
 * State machine for one MedScribe session lifecycle.
 * Manages: create → record → finalize → SSE stream → completed/failed.
 */
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { scribeApi, type ScribeSession } from "../api/scribe-api";
import { env } from "@/config/env";
import { STORAGE_KEYS } from "@/config/constants";
import { scribeKeys } from "./use-scribe";

export type StreamingSessionState =
  | "idle"
  | "creating"
  | "recording"
  | "finalizing"
  | "completed"
  | "failed";

interface StageStatus {
  soap: "pending" | "started" | "completed" | "failed";
  icd: "pending" | "started" | "completed" | "failed";
  summary: "pending" | "started" | "completed" | "failed";
}

interface UseStreamingSessionReturn {
  state: StreamingSessionState;
  session: ScribeSession | null;
  transcript: string;
  stages: StageStatus;
  error: string | null;
  start: (chiefComplaint?: string) => Promise<void>;
  stop: () => void;
  uploadChunk: (blob: Blob, durationMs: number) => Promise<void>;
}

const INITIAL_STAGES: StageStatus = {
  soap: "pending",
  icd: "pending",
  summary: "pending",
};

export function useStreamingSession(
  patientId: string
): UseStreamingSessionReturn {
  const qc = useQueryClient();

  const [state, setState] = useState<StreamingSessionState>("idle");
  const [session, setSession] = useState<ScribeSession | null>(null);
  const [transcript, setTranscript] = useState("");
  const [stages, setStages] = useState<StageStatus>({ ...INITIAL_STAGES });
  const [error, setError] = useState<string | null>(null);

  const sessionRef = useRef<ScribeSession | null>(null);
  const chunkSeqRef = useRef(0);
  const esRef = useRef<EventSource | null>(null);

  const openSSE = useCallback(
    (sessionId: string) => {
      const token = localStorage.getItem(STORAGE_KEYS.accessToken) ?? "";
      const url = `${env.API_BASE_URL}/scribe/sessions/${sessionId}/stream?access_token=${encodeURIComponent(token)}`;
      const es = new EventSource(url);
      esRef.current = es;

      es.addEventListener("transcript", (e: MessageEvent) => {
        try {
          const data: { sequence: number; text: string; transcript_so_far: string } =
            JSON.parse(e.data as string);
          setTranscript(data.transcript_so_far);
        } catch {
          // malformed event
        }
      });

      es.addEventListener(
        "stage",
        (e: MessageEvent) => {
          try {
            const data: {
              name: "soap" | "icd" | "summary";
              status: "started" | "completed" | "failed";
            } = JSON.parse(e.data as string);
            setStages((prev) => ({ ...prev, [data.name]: data.status }));
          } catch {
            // ignore
          }
        }
      );

      es.addEventListener("error", (e: MessageEvent) => {
        try {
          const data: { message: string } = JSON.parse(e.data as string);
          setError(data.message);
        } catch {
          setError("Streaming error");
        }
        setState("failed");
        es.close();
      });

      es.addEventListener("done", () => {
        setState("completed");
        es.close();
        // Invalidate so the caller can fetch the full session
        qc.invalidateQueries({ queryKey: scribeKeys.session(sessionId) });
        qc.invalidateQueries({
          queryKey: scribeKeys.patientSessions(patientId),
        });
      });

      es.onerror = () => {
        // Only treat as fatal if we haven't completed yet
        setState((prev) => {
          if (prev === "finalizing") {
            setError("Connection lost during processing");
            return "failed";
          }
          return prev;
        });
        es.close();
      };
    },
    [qc, patientId]
  );

  const start = useCallback(
    async (chiefComplaint?: string) => {
      if (state !== "idle") return;

      setState("creating");
      setError(null);
      setTranscript("");
      setStages({ ...INITIAL_STAGES });
      chunkSeqRef.current = 0;

      try {
        const newSession = await scribeApi.createSession({
          patientId,
          chiefComplaint,
        });
        sessionRef.current = newSession;
        setSession(newSession);
        setState("recording");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to create session");
        setState("failed");
      }
    },
    [state, patientId]
  );

  const uploadChunk = useCallback(async (blob: Blob, durationMs: number) => {
    const sess = sessionRef.current;
    if (!sess) return;
    const seq = chunkSeqRef.current++;
    try {
      const result = await scribeApi.uploadChunk(sess.id, blob, seq, durationMs);
      setTranscript(result.transcriptSoFar);
    } catch {
      // Non-fatal — a missed chunk is acceptable
    }
  }, []);

  const stop = useCallback(() => {
    const sess = sessionRef.current;
    if (!sess) return;

    setState("finalizing");

    // POST finalize (fire-and-forget — SSE done event is the source of truth)
    scribeApi.finalize(sess.id).catch(() => {
      // If finalize fails, SSE will eventually error too
    });

    // Open SSE stream
    openSSE(sess.id);
  }, [openSSE]);

  // Cleanup on unmount
  // (useEffect cleanup runs on unmount; we don't add it as a dep to avoid re-registering)

  return { state, session, transcript, stages, error, start, stop, uploadChunk };
}
