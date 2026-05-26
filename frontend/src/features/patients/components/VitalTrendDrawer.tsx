import { useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ReferenceArea,
  CartesianGrid,
} from "recharts";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { VitalReadingDrawer } from "@/features/patients/components/VitalReadingDrawer";
import { useDeleteVital } from "@/features/patients/hooks/use-vitals";
import {
  VITAL_METRICS,
  statusFor,
  formatValue,
  type VitalMetricKey,
  type VitalStatus,
} from "@/features/patients/lib/vital-metrics";
import { formatDate, formatTime, cn } from "@/lib/utils";
import type { VitalReading } from "@/features/patients/api/vitals-api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  metric: VitalMetricKey | null;
  readings: VitalReading[];
}

const statusTone: Record<VitalStatus, string> = {
  normal: "text-success",
  low: "text-info",
  elevated: "text-warning",
  critical: "text-danger",
};

const statusBadge: Record<VitalStatus, "success" | "info" | "warning" | "danger"> = {
  normal: "success",
  low: "info",
  elevated: "warning",
  critical: "danger",
};

export function VitalTrendDrawer({
  open,
  onOpenChange,
  patientId,
  metric,
  readings,
}: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<VitalReading | null>(null);
  const remove = useDeleteVital(patientId);

  if (!metric) return null;
  const meta = VITAL_METRICS[metric];

  // Oldest-first for the chart, newest-first for the list.
  const series = readings
    .filter((r) => r.metric === metric)
    .slice()
    .sort((a, b) => +new Date(a.recordedAt) - +new Date(b.recordedAt))
    .map((r) => ({
      ts: r.recordedAt,
      ms: +new Date(r.recordedAt),
      value: r.value,
      id: r.id,
    }));

  const newestFirst = [...series].reverse();
  const values = series.map((p) => p.value);
  const dataMin = values.length ? Math.min(...values) : 0;
  const dataMax = values.length ? Math.max(...values) : 1;
  // Pad domain so the line doesn't kiss the edges.
  const span = Math.max(dataMax - dataMin, 1);
  const yMin = Math.floor(dataMin - span * 0.15);
  const yMax = Math.ceil(dataMax + span * 0.15);

  return (
    <>
      <Drawer
        open={open}
        onOpenChange={onOpenChange}
        title={meta.label}
        description={
          meta.normal
            ? `Normal range ${meta.normal[0]}–${meta.normal[1]} ${meta.defaultUnit}`
            : `${meta.defaultUnit}`
        }
        size="lg"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-xs text-muted-foreground">
              {series.length === 0
                ? "No readings yet."
                : `${series.length} reading${series.length === 1 ? "" : "s"}`}
            </div>
            <Button size="sm" onClick={() => setAddOpen(true)}>
              <Plus className="size-3.5" /> Add reading
            </Button>
          </div>

          {series.length > 0 && (
            <div className="rounded-2xl bg-surface-subtle border border-border/60 p-3">
              <div className="h-48 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={series}
                    margin={{ top: 8, right: 12, bottom: 4, left: 0 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="rgb(229 231 235)" />
                    {meta.normal && (
                      <ReferenceArea
                        y1={meta.normal[0]}
                        y2={meta.normal[1]}
                        fill="rgb(16 185 129 / 0.08)"
                        stroke="none"
                      />
                    )}
                    <XAxis
                      dataKey="ms"
                      type="number"
                      domain={["dataMin", "dataMax"]}
                      tickFormatter={(ms) =>
                        new Date(ms).toLocaleString(undefined, {
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                        })
                      }
                      stroke="rgb(148 163 184)"
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis
                      domain={[yMin, yMax]}
                      stroke="rgb(148 163 184)"
                      tick={{ fontSize: 11 }}
                      width={36}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: 12,
                        border: "1px solid rgb(226 232 240)",
                        fontSize: 12,
                      }}
                      labelFormatter={(ms) =>
                        new Date(ms as number).toLocaleString()
                      }
                      formatter={(value: number) => [
                        `${formatValue(value, meta.step)} ${meta.defaultUnit}`,
                        meta.label,
                      ]}
                    />
                    <Line
                      type="monotone"
                      dataKey="value"
                      stroke="rgb(99 102 241)"
                      strokeWidth={2}
                      dot={{ r: 3 }}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          )}

          <div>
            <h4 className="text-xs uppercase tracking-wide text-muted-foreground font-semibold px-1 mb-2">
              History
            </h4>
            {series.length === 0 && (
              <div className="text-sm text-muted-foreground text-center py-6 rounded-xl bg-surface-subtle">
                No readings recorded. Tap <strong>Add reading</strong> to start.
              </div>
            )}
            <ul className="space-y-1.5">
              {newestFirst.map((p) => {
                const status = statusFor(meta, p.value);
                return (
                  <li
                    key={p.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-surface-subtle/60 border border-border/60 px-3 py-2"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-semibold leading-none">
                        <span className={statusTone[status]}>
                          {formatValue(p.value, meta.step)}
                        </span>
                        <span className="text-xs text-muted-foreground ml-1">
                          {meta.defaultUnit}
                        </span>
                      </div>
                      <div className="text-[10px] text-muted-foreground mt-1">
                        {formatDate(p.ts)} · {formatTime(p.ts)}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusBadge[status]} size="sm" className="capitalize">
                        {status}
                      </Badge>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Remove reading"
                        className={cn("size-8 rounded-full text-danger")}
                        onClick={() => {
                          const reading = readings.find((r) => r.id === p.id);
                          if (reading) setPendingDelete(reading);
                        }}
                      >
                        {remove.isPending ? (
                          <Loader2 className="size-4 animate-spin" />
                        ) : (
                          <Trash2 className="size-4" />
                        )}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Drawer>

      <VitalReadingDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        patientId={patientId}
        defaultMetric={metric}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title="Remove reading?"
        description="This will permanently delete the reading from the chart."
        confirmLabel="Remove"
        destructive
        busy={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}
