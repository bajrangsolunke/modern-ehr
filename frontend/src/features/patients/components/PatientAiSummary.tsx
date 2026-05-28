/**
 * Auto-loading collapsible AI summary card mounted at the top of the
 * patient profile (below PatientHeader, above AlertsStrip). Mirrors
 * the IntakeAiSummary visual pattern so the chart and intake flows
 * look like one cohesive AI surface.
 */
import { useState } from "react";
import { ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useChartAi, useRegenerateSummary } from "../hooks/use-chart-ai";
import { Button } from "@/components/ui/button";
import { AiTag } from "@/components/ui/ai-tag";
import { cn, formatDate } from "@/lib/utils";

interface Props {
  patientId: string;
}

export function PatientAiSummary({ patientId }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { data, isLoading, isError } = useChartAi(patientId);
  const regen = useRegenerateSummary(patientId);

  if (isLoading) {
    return (
      <section className="no-print rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Generating clinical summary…</span>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    return null;
  }

  const summary = data.summary;
  const confidencePct = Math.round(summary.confidence * 100);

  return (
    <section className="no-print rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-controls={`patient-ai-summary-${patientId}`}
          className="flex items-start gap-2 min-w-0 text-left flex-1 rounded-lg -m-1 p-1 hover:bg-primary/5 transition"
        >
          <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
              AI clinical summary
              <AiTag>{summary.model}</AiTag>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                · {confidencePct}% confidence
              </span>
              {summary.cached && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  · cached
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generated {formatDate(summary.generatedAt)}. AI-generated — verify with the patient before clinical decisions.
            </p>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground shrink-0 mt-1 transition-transform",
              collapsed && "-rotate-90"
            )}
            aria-hidden
          />
        </button>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onClick={() => regen.mutate()}
          disabled={regen.isPending}
        >
          {regen.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}{" "}
          Regenerate
        </Button>
      </div>

      {!collapsed && (
        <div id={`patient-ai-summary-${patientId}`} className="space-y-3">
          <p className="text-sm leading-relaxed">{summary.summary}</p>

          {summary.bullets.length > 0 && (
            <ul className="space-y-1 text-sm">
              {summary.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 leading-snug">
                  <span className="mt-1.5 size-1 rounded-full shrink-0 bg-muted-foreground" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
