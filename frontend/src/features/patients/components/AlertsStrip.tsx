import { useState } from "react";
import { AlertOctagon, AlertTriangle, Info, Loader2, Plus, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AlertDrawer } from "@/features/patients/components/AlertDrawer";
import {
  useDeleteAlert,
  usePatientAlerts,
} from "@/features/patients/hooks/use-patient-alerts";
import type { AlertSeverity, PatientAlert } from "@/features/patients/api/alerts-api";
import { cn } from "@/lib/utils";

interface Props {
  patientId: string;
}

const sevMap: Record<
  AlertSeverity,
  { icon: typeof AlertOctagon; bg: string; border: string; text: string }
> = {
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
};

export function AlertsStrip({ patientId }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [pendingRemove, setPendingRemove] = useState<PatientAlert | null>(null);
  const { data, isLoading } = usePatientAlerts(patientId);
  const remove = useDeleteAlert(patientId);

  // Hide entirely on first load — the strip pops in when alerts arrive.
  if (isLoading) {
    return (
      <Card className="overflow-hidden">
        <CardContent className="p-3 flex items-center gap-2">
          <Skeleton className="h-7 w-16 rounded-full" />
          <Skeleton className="h-7 w-32 rounded-full" />
          <Skeleton className="h-7 w-24 rounded-full" />
        </CardContent>
      </Card>
    );
  }

  const alerts = data ?? [];
  const hasAny = alerts.length > 0;

  return (
    <>
      <Card className="overflow-hidden">
        <CardContent className="p-3 flex items-center gap-2 overflow-x-auto scrollbar-hide">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground shrink-0 px-2">
            Alerts
          </span>
          {!hasAny && (
            <span className="text-xs text-muted-foreground italic px-1">
              No alerts on file.
            </span>
          )}
          {alerts.map((a) => {
            const m = sevMap[a.severity];
            const Icon = m.icon;
            return (
              <div
                key={a.id}
                className={cn(
                  "group inline-flex items-center gap-2 rounded-full bg-white border px-3 py-1.5 shrink-0",
                  m.border
                )}
              >
                <span
                  className={cn(
                    "size-6 rounded-full grid place-items-center shrink-0",
                    m.bg
                  )}
                >
                  <Icon className={cn("size-3.5", m.text)} />
                </span>
                <div className="flex items-baseline gap-1.5 leading-tight">
                  <span className="text-[13px] font-semibold">{a.label}</span>
                  {a.detail && (
                    <span className="text-[12px] text-muted-foreground">
                      {a.detail}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  className="size-5 rounded-full grid place-items-center text-muted-foreground/60 hover:text-danger hover:bg-danger/10 ring-focus transition shrink-0"
                  aria-label={`Remove ${a.label}`}
                  onClick={() => setPendingRemove(a)}
                  disabled={remove.isPending}
                >
                  {remove.isPending && pendingRemove?.id === a.id ? (
                    <Loader2 className="size-3 animate-spin" />
                  ) : (
                    <X className="size-3" />
                  )}
                </button>
              </div>
            );
          })}
          <Button
            variant="ghost"
            size="sm"
            className="rounded-full h-9 shrink-0 ml-auto"
            aria-label="Add alert"
            onClick={() => setAddOpen(true)}
          >
            <Plus className="size-3.5" />
            Add alert
          </Button>
        </CardContent>
      </Card>

      <AlertDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        patientId={patientId}
      />

      <ConfirmDialog
        open={Boolean(pendingRemove)}
        onOpenChange={(open) => !open && setPendingRemove(null)}
        title={pendingRemove ? `Remove “${pendingRemove.label}”?` : "Remove alert?"}
        description="The alert chip will be removed from the patient header."
        confirmLabel="Remove"
        destructive
        busy={remove.isPending}
        onConfirm={async () => {
          if (!pendingRemove) return;
          await remove.mutateAsync(pendingRemove.id);
          setPendingRemove(null);
        }}
      />
    </>
  );
}
