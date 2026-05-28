/**
 * Drawer pop-up with risk score drivers + recommended actions.
 * Triggered by clicking the PatientRiskChip in the header.
 */
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { AiTag } from "@/components/ui/ai-tag";
import { cn } from "@/lib/utils";
import { useChartAi, useRegenerateRisk } from "../hooks/use-chart-ai";
import type { RiskLevel } from "../api/ai-api";

interface Props {
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RISK_LEVEL_TONE: Record<RiskLevel, string> = {
  low: "bg-success/10 text-success",
  moderate: "bg-warning/10 text-warning",
  high: "bg-danger/10 text-danger",
  critical: "bg-danger/15 text-danger",
};

const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
};

export function PatientRiskDrawer({ patientId, open, onOpenChange }: Props) {
  const { data } = useChartAi(patientId);
  const regen = useRegenerateRisk(patientId);
  const risk = data?.risk;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Risk score"
    >
      {!risk ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading…
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "rounded-2xl px-4 py-3 flex items-center gap-3",
                RISK_LEVEL_TONE[risk.riskLevel]
              )}
            >
              <div className="text-3xl font-bold">{risk.riskScore}</div>
              <div className="text-sm font-semibold uppercase tracking-wider">
                {RISK_LEVEL_LABEL[risk.riskLevel]}
              </div>
            </div>
            <AiTag>{risk.model}</AiTag>
          </div>

          {risk.drivers.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Drivers
              </div>
              <ul className="space-y-1 text-sm">
                {risk.drivers.map((d, i) => (
                  <li key={i} className="flex gap-2 leading-snug">
                    <span className="mt-1.5 size-1 rounded-full shrink-0 bg-muted-foreground" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {risk.recommendedActions.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-2 inline-flex items-center gap-1">
                <Sparkles className="size-3" /> Recommended actions
              </div>
              <ul className="space-y-1 text-sm">
                {risk.recommendedActions.map((a, i) => (
                  <li key={i} className="flex gap-2 leading-snug">
                    <span className="mt-1.5 size-1 rounded-full shrink-0 bg-primary" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => regen.mutate()}
            disabled={regen.isPending}
            className="w-full"
          >
            {regen.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}{" "}
            Regenerate
          </Button>
        </div>
      )}
    </Drawer>
  );
}
