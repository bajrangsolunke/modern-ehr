import {
  Activity,
  Droplets,
  FlaskConical,
  HeartPulse,
  Moon,
  Scale,
  Thermometer,
  TrendingDown,
  TrendingUp,
  Wind,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { MiniSparkline } from "./MiniSparkline";
import type { HealthMetric, HealthMetricStatus } from "../api/dashboard-api";

const ICONS: Record<string, React.ReactNode> = {
  blood_pressure: <Droplets className="size-5" />,
  heart_rate: <HeartPulse className="size-5" />,
  glucose: <FlaskConical className="size-5" />,
  hemoglobin: <Activity className="size-5" />,
  oxygen_saturation: <Wind className="size-5" />,
  sleep_score: <Moon className="size-5" />,
  weight: <Scale className="size-5" />,
  temperature: <Thermometer className="size-5" />,
  respiratory_rate: <Wind className="size-5" />,
};

const STATUS_DOT: Record<HealthMetricStatus, string> = {
  normal: "bg-success",
  higher: "bg-danger",
  lower: "bg-info",
  critical: "bg-danger animate-pulse",
  unknown: "bg-slate-300",
};

const STATUS_TEXT_COLOR: Record<HealthMetricStatus, string> = {
  normal: "text-success",
  higher: "text-danger",
  lower: "text-info",
  critical: "text-danger",
  unknown: "text-slate-400",
};

const PLACEHOLDER: Record<string, { label: string; unit: string }> = {
  blood_pressure: { label: "Blood Pressure", unit: "mmHg" },
  heart_rate: { label: "Heart Rate", unit: "bpm" },
  glucose: { label: "Glucose", unit: "mg/dL" },
  hemoglobin: { label: "Hemoglobin", unit: "g/dL" },
  oxygen_saturation: { label: "Oxygen", unit: "%" },
  sleep_score: { label: "Sleep score", unit: "/100" },
  weight: { label: "Weight", unit: "kg" },
  temperature: { label: "Temperature", unit: "°C" },
  respiratory_rate: { label: "Respiratory", unit: "/min" },
};

function trendInfo(series: number[]): { pct: number; up: boolean } | null {
  if (series.length < 2) return null;
  const first = series[0];
  const last = series[series.length - 1];
  if (first === 0) return null;
  const pct = ((last - first) / Math.abs(first)) * 100;
  if (!isFinite(pct)) return null;
  return { pct: Math.abs(Math.round(pct)), up: pct >= 0 };
}

interface Props {
  metric?: HealthMetric;
  metricKey?: string;
  className?: string;
}

export function HealthMetricCard({ metric, metricKey, className }: Props) {
  const key = metric?.metric ?? metricKey ?? "unknown";
  const placeholder = PLACEHOLDER[key];

  const effective: HealthMetric = metric ?? {
    metric: key,
    label: placeholder?.label ?? key,
    value: "—",
    unit: placeholder?.unit ?? null,
    recorded_at: null,
    status: "unknown",
    status_text: "No data",
    series: [],
  };

  const icon = ICONS[effective.metric] ?? <Activity className="size-5" />;
  const trend = trendInfo(effective.series);
  const hasSeries = effective.series.length >= 2;

  return (
    <Card
      className={cn(
        "relative overflow-hidden p-4 flex flex-col gap-3 min-w-0",
        "rounded-3xl border-slate-200/70 bg-white",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)]",
        "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_2px_4px_rgba(15,23,42,0.06),0_14px_32px_-12px_rgba(79,140,255,0.18)]",
        className
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="size-10 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
          {icon}
        </div>
        {trend && (
          <div
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10.5px] font-semibold",
              trend.up
                ? "bg-rose-50 text-rose-600"
                : "bg-emerald-50 text-emerald-600"
            )}
          >
            {trend.up ? (
              <TrendingUp className="size-3" />
            ) : (
              <TrendingDown className="size-3" />
            )}
            {trend.pct}%
          </div>
        )}
      </div>

      <div>
        <div className="text-[12px] font-medium text-slate-500 truncate">
          {effective.label}
        </div>
        <div className="flex items-baseline gap-1 mt-0.5">
          <span className="text-[22px] font-bold tabular-nums leading-none text-slate-900">
            {effective.value}
          </span>
          {effective.unit && (
            <span className="text-[11px] text-slate-400">{effective.unit}</span>
          )}
        </div>
      </div>

      {hasSeries ? (
        <div className="h-7 -mx-1 text-primary">
          <MiniSparkline
            series={effective.series}
            width={140}
            height={28}
            filled
            className="w-full h-full"
          />
        </div>
      ) : (
        <div className="h-7" />
      )}

      {effective.status_text && (
        <div className="flex items-center gap-1.5">
          <span className={cn("size-1.5 rounded-full shrink-0", STATUS_DOT[effective.status])} />
          <span
            className={cn(
              "text-[10.5px] font-medium leading-none",
              STATUS_TEXT_COLOR[effective.status]
            )}
          >
            {effective.status_text}
          </span>
        </div>
      )}
    </Card>
  );
}
