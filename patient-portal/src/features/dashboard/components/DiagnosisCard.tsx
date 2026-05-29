import { Stethoscope } from "lucide-react";
import { Card } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import type { DashboardConditionInfo } from "../api/dashboard-api";

interface Props {
  condition: DashboardConditionInfo | null;
}

function LabeledRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
        {label}
      </span>
      <span className="text-sm text-foreground leading-snug">{value}</span>
    </div>
  );
}

export function DiagnosisCard({ condition }: Props) {
  return (
    <Card className="p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="size-8 rounded-xl bg-warning/10 text-warning grid place-items-center shrink-0">
          <Stethoscope className="size-4" />
        </div>
        <h3 className="text-sm font-semibold">Illness Diagnosis</h3>
      </div>

      {condition ? (
        <div className="grid grid-cols-1 gap-3">
          <LabeledRow label="Condition" value={condition.name} />
          <LabeledRow label="ICD-10 Code" value={condition.code} />
          <LabeledRow
            label="Diagnosed"
            value={condition.diagnosed_at ? formatDate(condition.diagnosed_at) : null}
          />
          <LabeledRow label="Treatment" value={condition.treatment} />
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">
          No active diagnoses on file.
        </p>
      )}
    </Card>
  );
}
