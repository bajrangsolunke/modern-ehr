import { AlertOctagon, AlertTriangle, Info, Plus } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

/**
 * Compact horizontal alerts strip that lives at the top of the patient
 * profile and stays visible across tabs. Each chip is a critical fact a
 * clinician should see at a glance: blood thinner, DNR, code status,
 * isolation, falls risk, etc.
 *
 * Today the data is hard-coded — Story 2 will wire it to a real
 * /patients/:id/alerts endpoint and turn the "+ Add" button on.
 */
interface AlertChipData {
  id: string;
  severity: "critical" | "warning" | "info";
  label: string;
  detail?: string;
}

// TODO(Phase B / Story 2): replace with usePatientAlerts(patientId) hook
const SAMPLE: AlertChipData[] = [
  { id: "a-1", severity: "critical", label: "Blood thinner", detail: "Apixaban — paused 12.05.2025" },
  { id: "a-2", severity: "warning", label: "DNR", detail: "Yes" },
  { id: "a-3", severity: "info", label: "Lab tests", detail: "Update Hb/INR" },
];

const sevMap = {
  critical: {
    icon: AlertOctagon,
    bg: "bg-danger/10",
    border: "border-danger/30",
    text: "text-danger",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-warning/10",
    border: "border-warning/30",
    text: "text-warning",
  },
  info: {
    icon: Info,
    bg: "bg-info/10",
    border: "border-info/30",
    text: "text-info",
  },
} as const;

export function AlertsStrip() {
  const alerts = SAMPLE;

  if (alerts.length === 0) {
    return null;
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 px-2">
          Alerts
        </span>
        {alerts.map((a) => {
          const m = sevMap[a.severity];
          const Icon = m.icon;
          return (
            <div
              key={a.id}
              className={cn(
                "inline-flex items-center gap-2 rounded-full bg-white border px-3 py-1.5 shrink-0",
                m.border
              )}
            >
              <span className={cn("size-6 rounded-full grid place-items-center shrink-0", m.bg)}>
                <Icon className={cn("size-3.5", m.text)} />
              </span>
              <div className="flex items-baseline gap-1.5 leading-tight">
                <span className="text-[13px] font-semibold">{a.label}</span>
                {a.detail && (
                  <span className="text-[12px] text-muted-foreground">{a.detail}</span>
                )}
              </div>
            </div>
          );
        })}
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full h-9 shrink-0 ml-auto"
          aria-label="Add alert"
        >
          <Plus className="size-3.5" />
          Add alert
        </Button>
      </CardContent>
    </Card>
  );
}
