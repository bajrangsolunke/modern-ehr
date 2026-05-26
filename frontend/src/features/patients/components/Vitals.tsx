import { useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight, Minus, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import { VitalReadingDrawer } from "@/features/patients/components/VitalReadingDrawer";
import { VitalTrendDrawer } from "@/features/patients/components/VitalTrendDrawer";
import { useVitals } from "@/features/patients/hooks/use-vitals";
import {
  VITAL_METRIC_LIST,
  formatValue,
  statusFor,
  trendBetween,
  type VitalMetricKey,
  type VitalStatus,
} from "@/features/patients/lib/vital-metrics";
import type { VitalReading } from "@/features/patients/api/vitals-api";
import { cn, formatTime } from "@/lib/utils";

const statusTone: Record<VitalStatus, string> = {
  normal: "text-success",
  low: "text-info",
  elevated: "text-warning",
  critical: "text-danger",
};

interface Props {
  patientId: string;
}

interface MetricTileData {
  metric: VitalMetricKey;
  label: string;
  short: string;
  unit: string;
  latest?: VitalReading;
  prev?: VitalReading;
  status: VitalStatus;
  trend?: "up" | "down" | "flat";
}

export function Vitals({ patientId }: Props) {
  const [addOpen, setAddOpen] = useState(false);
  const [trendMetric, setTrendMetric] = useState<VitalMetricKey | null>(null);

  const { data, isLoading, isError, error, refetch, isFetching } = useVitals(patientId);

  // Bucket the flat reading list by metric, sorted newest-first.
  const byMetric: MetricTileData[] = useMemo(() => {
    const readings = data ?? [];
    return VITAL_METRIC_LIST.map((meta) => {
      const list = readings
        .filter((r) => r.metric === meta.key)
        .sort((a, b) => +new Date(b.recordedAt) - +new Date(a.recordedAt));
      const latest = list[0];
      const prev = list[1];
      const status = latest ? statusFor(meta, latest.value) : "normal";
      const trend = latest ? trendBetween(latest.value, prev?.value) : undefined;
      return {
        metric: meta.key,
        label: meta.label,
        short: meta.short,
        unit: meta.defaultUnit,
        latest,
        prev,
        status,
        trend,
      } satisfies MetricTileData;
    }).filter((t) => t.latest); // only show metrics with at least one reading
  }, [data]);

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="min-w-0">
            <CardTitle>Vitals</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Tap a tile to see the trend.
            </p>
          </div>
          <Button size="sm" variant="soft" onClick={() => setAddOpen(true)}>
            <Plus className="size-3.5" /> Add reading
          </Button>
        </CardHeader>
        <CardContent className="pb-5">
          {isLoading && <VitalsSkeleton />}

          {isError && !isLoading && (
            <ErrorBanner
              title="Couldn't load vitals"
              message={error instanceof Error ? error.message : "Please try again."}
              onRetry={() => refetch()}
              retrying={isFetching}
            />
          )}

          {!isLoading && !isError && byMetric.length === 0 && (
            <div className="text-sm text-muted-foreground text-center py-6 rounded-xl bg-surface-subtle">
              No vitals recorded yet. Tap <strong>Add reading</strong> to record the first one.
            </div>
          )}

          {!isLoading && !isError && byMetric.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {byMetric.map((tile) => (
                <button
                  key={tile.metric}
                  type="button"
                  onClick={() => setTrendMetric(tile.metric)}
                  className="text-left rounded-xl bg-surface-subtle border border-border/60 p-3 hover:bg-surface-subtle/80 hover:border-border ring-focus transition"
                >
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span className="truncate">{tile.label}</span>
                    {tile.trend === "up" && <ArrowUpRight className="size-3 text-danger" />}
                    {tile.trend === "down" && <ArrowDownRight className="size-3 text-info" />}
                    {tile.trend === "flat" && <Minus className="size-3 text-muted-foreground" />}
                  </div>
                  <div className="mt-1 text-lg font-bold leading-none">
                    {tile.latest ? formatValue(tile.latest.value) : "—"}
                    <span className="text-xs text-muted-foreground font-normal ml-1">
                      {tile.latest?.unit ?? tile.unit}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <div
                      className={cn(
                        "text-[10px] uppercase tracking-wider font-semibold",
                        statusTone[tile.status]
                      )}
                    >
                      {tile.status}
                    </div>
                    {tile.latest && (
                      <div className="text-[10px] text-muted-foreground">
                        {formatTime(tile.latest.recordedAt)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <VitalReadingDrawer
        open={addOpen}
        onOpenChange={setAddOpen}
        patientId={patientId}
      />

      <VitalTrendDrawer
        open={trendMetric !== null}
        onOpenChange={(open) => !open && setTrendMetric(null)}
        patientId={patientId}
        metric={trendMetric}
        readings={data ?? []}
      />
    </>
  );
}

function VitalsSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  );
}
