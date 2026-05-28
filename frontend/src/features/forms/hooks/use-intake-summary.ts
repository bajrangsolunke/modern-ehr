/**
 * Generates an AI summary of a submitted intake form on demand.
 * Lazy (enabled only when caller flips `enabled`) so we don't burn API
 * calls just by opening the form details modal — provider clicks the
 * "Summarize with AI" button to trigger.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { formsAiApi, type IntakeSummary } from "../api/ai-api";
import { toast } from "@/lib/toast";

const AI_KEY = ["forms", "ai", "intake-summary"] as const;

export function useIntakeSummary(
  formId: string | undefined,
  options: { enabled?: boolean; style?: "clinical" | "patient-friendly" | "brief" } = {}
) {
  const { enabled = false, style = "clinical" } = options;

  return useQuery<IntakeSummary>({
    queryKey: [...AI_KEY, formId, style],
    queryFn: () => formsAiApi.intakeSummary(formId as string, style),
    enabled: Boolean(formId) && enabled,
    // The summary is deterministic-ish per form snapshot — we cache for
    // 5 min so re-opening the modal doesn't re-roll the model.
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

/** Imperative refresh — clears the cache so the next render re-fetches. */
export function useResetIntakeSummary() {
  const qc = useQueryClient();
  return (formId: string) => {
    qc.removeQueries({ queryKey: [...AI_KEY, formId] });
    toast.info("Regenerating summary…");
  };
}
