/**
 * Color-coded risk pill rendered inside PatientHeader. Click opens
 * PatientRiskDrawer. Shows a skeleton while the chart-AI fetch is
 * in flight; hides entirely if the fetch fails.
 */
import { useState } from "react";
import { useChartAi } from "../hooks/use-chart-ai";
import { PatientRiskDrawer, RISK_LEVEL_TONE } from "./PatientRiskDrawer";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface Props {
  patientId: string;
}

const LEVEL_LABEL = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
} as const;

export function PatientRiskChip({ patientId }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data, isLoading, isError } = useChartAi(patientId);

  if (isLoading) {
    return (
      <span className="inline-flex h-6 w-24 animate-pulse rounded-full bg-muted/60" />
    );
  }
  if (isError || !data) return null;
  const r = data.risk;

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition hover:brightness-95",
          RISK_LEVEL_TONE[r.riskLevel]
        )}
        title="Click for drivers + recommended actions"
      >
        <Sparkles className="size-3" />
        Risk {r.riskScore} · {LEVEL_LABEL[r.riskLevel]}
      </button>
      <PatientRiskDrawer
        patientId={patientId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}
