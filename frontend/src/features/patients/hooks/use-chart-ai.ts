/**
 * Auto-fetches the AI chart context (summary + risk + ai_alerts_count)
 * when the patient profile mounts. The server cache is authoritative
 * for freshness — the client never hides a refetch behind a staleTime.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patientsAiApi, type PatientChartContext } from "../api/ai-api";
import { toast } from "@/lib/toast";

const KEY = ["patient", "chart-ai"] as const;

export function chartAiKey(patientId: string | undefined) {
  return [...KEY, patientId];
}

export function useChartAi(patientId: string | undefined) {
  return useQuery<PatientChartContext>({
    queryKey: chartAiKey(patientId),
    queryFn: () => patientsAiApi.getChartContext(patientId as string),
    enabled: Boolean(patientId),
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

export function useRegenerateSummary(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => patientsAiApi.regenerateSummary(patientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chartAiKey(patientId) });
      toast.success("Summary regenerated");
    },
    onError: (err) =>
      toast.error("Couldn't regenerate summary", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useRegenerateRisk(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => patientsAiApi.regenerateRisk(patientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chartAiKey(patientId) });
      toast.success("Risk score regenerated");
    },
    onError: (err) =>
      toast.error("Couldn't regenerate risk", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
