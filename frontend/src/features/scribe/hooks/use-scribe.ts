/**
 * React Query hooks for MedScribe data fetching and mutations.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  scribeApi,
  type ScribeSession,
  type ScribeSessionFull,
  type ScribeSoapNote,
  type ScribeIcdSuggestion,
} from "../api/scribe-api";
import { toast } from "@/lib/toast";

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const scribeKeys = {
  all: ["scribe"] as const,
  patientSessions: (patientId: string) =>
    ["scribe", "patient", patientId, "sessions"] as const,
  session: (id: string) => ["scribe", "session", id] as const,
};

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export function usePatientScribeSessions(patientId: string) {
  return useQuery<ScribeSession[]>({
    queryKey: scribeKeys.patientSessions(patientId),
    queryFn: () => scribeApi.listForPatient(patientId),
    enabled: Boolean(patientId),
    staleTime: 30_000,
    gcTime: 5 * 60_000,
  });
}

export function useScribeSession(id: string | undefined) {
  return useQuery<ScribeSessionFull>({
    queryKey: scribeKeys.session(id ?? ""),
    queryFn: () => scribeApi.getSession(id as string),
    enabled: Boolean(id),
    staleTime: 0,
    gcTime: 10 * 60_000,
    refetchOnWindowFocus: false,
  });
}

// ---------------------------------------------------------------------------
// Mutations
// ---------------------------------------------------------------------------

export function usePatchSoap(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (
      input: Partial<{
        subjective: string;
        objective: string;
        assessment: string;
        plan: string;
      }>
    ): Promise<ScribeSoapNote> => scribeApi.patchSoap(sessionId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scribeKeys.session(sessionId) });
      toast.success("SOAP note saved");
    },
    onError: (err) =>
      toast.error("Failed to save SOAP note", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function usePatchIcd(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({
      icdId,
      input,
    }: {
      icdId: string;
      input: Partial<{
        code: string;
        description: string;
        accepted_by_user: boolean;
      }>;
    }): Promise<ScribeIcdSuggestion> =>
      scribeApi.patchIcd(sessionId, icdId, input),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scribeKeys.session(sessionId) });
      toast.success("ICD code updated");
    },
    onError: (err) =>
      toast.error("Failed to update ICD code", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useDeleteIcd(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (icdId: string): Promise<void> =>
      scribeApi.deleteIcd(sessionId, icdId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scribeKeys.session(sessionId) });
      toast.success("ICD suggestion removed");
    },
    onError: (err) =>
      toast.error("Failed to remove ICD suggestion", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function usePatchSummary(sessionId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (visitSummary: string): Promise<ScribeSession> =>
      scribeApi.patchSummary(sessionId, visitSummary),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: scribeKeys.session(sessionId) });
      toast.success("Visit summary saved");
    },
    onError: (err) =>
      toast.error("Failed to save summary", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
