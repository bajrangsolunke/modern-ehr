/**
 * TrendChartCard — larger card showing a metric's reading history.
 * Uses MiniSparkline (line) for general metrics, MiniBarChart for blood pressure.
 */
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/utils";
import { MiniSparkline } from "./MiniSparkline";
import { MiniBarChart } from "./MiniBarChart";
import type { HealthMetric, HealthMetricStatus } from "../api/dashboard-api";

// Status text colour stays semantic (Normal/Higher/Lower). The big number,
// chart line + chart bars stay brand blue for visual consistency across cards.
const STATUS_TEXT_COLOR: Record<HealthMetricStatus, string> = {
  normal:   "text-success",
  higher:   "text-danger",
  lower:    "text-info",
  critical: "text-danger",
  unknown:  "text-muted-foreground",
};

const PLACEHOLDER: Record<string, { label: string; unit: string }> = {
  hemoglobin:     { label: "Hemoglobin",     unit: "g/dL" },
  blood_pressure: { label: "Blood Pressure", unit: "mmHg" },
  heart_rate:     { label: "Heart Rate",     unit: "bpm" },
  glucose:        { label: "Glucose",        unit: "mg/dL" },
};

interface Props {
  metric?: HealthMetric;
  metricKey?: string;
  className?: string;
}

export function TrendChartCard({ metric, metricKey, className }: Props) {
  const key = metric?.metric ?? metricKey ?? "unknown";
  const placeholder = PLACEHOLDER[key];

  const effective: HealthMetric = metric ?? {
    metric: key,
    label: placeholder?.label ?? key,
    value: "—",
    unit: placeholder?.unit ?? null,
    recorded_at: null,
    status: "unknown",
    status_text: null,
    series: [],
  };

  const statusColor = STATUS_TEXT_COLOR[effective.status];
  const hasSeries = effective.series.length >= 2;
  const isBP = effective.metric === "blood_pressure";

  return (
    <Card className={cn("p-5 flex flex-col gap-3", className)}>
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold leading-tight">{effective.label}</h3>
        {effective.recorded_at && (
          <span className="text-[10px] text-muted-foreground whitespace-nowrap shrink-0">
            Updated {formatDate(effective.recorded_at)}
          </span>
        )}
      </div>

      {/* Chart area — brand blue, regardless of status */}
      {hasSeries ? (
        <div className="w-full h-[72px] flex items-end text-primary">
          {isBP ? (
            <MiniBarChart series={effective.series} width={260} height={72} className="w-full h-full" />
          ) : (
            <MiniSparkline series={effective.series} width={260} height={72} className="w-full h-full" filled />
          )}
        </div>
      ) : (
        <div className="h-[72px] flex items-center justify-center text-xs text-muted-foreground">
          No readings yet
        </div>
      )}

      {/* Latest value */}
      <div className="flex items-baseline gap-1.5 pt-2 border-t border-border">
        <span className="text-2xl font-bold tabular-nums text-foreground">
          {effective.value}
        </span>
        {effective.unit && (
          <span className="text-xs text-muted-foreground">{effective.unit}</span>
        )}
        {effective.status_text && (
          <span className={cn("ml-auto text-xs font-medium", statusColor)}>
            {effective.status_text}
          </span>
        )}
      </div>
    </Card>
  );
}
