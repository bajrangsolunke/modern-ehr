/**
 * React Query hook layer for telehealth. The TelehealthModal owns the
 * Daily call object; this hook handles session creation + the
 * transcript poll fallback + SOAP generation mutation.
 */
import {
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { telehealthApi } from "../api/telehealth-api";

const TELEHEALTH_KEY = ["telehealth"] as const;

export function useStartTelehealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (appointmentId: string) =>
      telehealthApi.startOrGet(appointmentId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TELEHEALTH_KEY });
    },
  });
}

export function useEndTelehealth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => telehealthApi.end(sessionId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: TELEHEALTH_KEY });
    },
  });
}

/**
 * Polls the transcript every 2s as a fallback against the client
 * losing a few `transcription-message` events. Stops once the
 * caller passes `enabled: false` (call ended).
 */
export function useTranscript(sessionId: string | null, enabled = true) {
  return useQuery({
    queryKey: [...TELEHEALTH_KEY, "transcript", sessionId],
    queryFn: () => telehealthApi.listTranscript(sessionId as string),
    enabled: Boolean(sessionId) && enabled,
    refetchInterval: enabled ? 2_000 : false,
  });
}

export function useGenerateSoap() {
  return useMutation({
    mutationFn: (sessionId: string) => telehealthApi.generateSoap(sessionId),
  });
}
