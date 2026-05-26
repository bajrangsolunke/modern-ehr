import { api } from "@/lib/api-client";

interface KpiCardDto {
  label: string;
  value: number;
  delta?: number | null;
  unit?: string | null;
  hint?: string | null;
}
interface TrendPointDto {
  label: string;
  value?: number | null;
  series?: Record<string, number> | null;
}
interface BottleneckRowDto {
  name: string;
  percent_affected: string;
  trend: string;
  direction: string;
  impact: string;
  suggested_fix: string;
}
interface HeatmapCellDto {
  body_part: string;
  values: number[];
}

export interface DashboardSnapshot {
  kpis: KpiCardDto[];
  bottlenecks: BottleneckRowDto[];
  complication_trend: TrendPointDto[];
  proms_trend: TrendPointDto[];
  heatmap: HeatmapCellDto[];
}

export const analyticsApi = {
  snapshot: (fallback?: DashboardSnapshot) =>
    api.get<DashboardSnapshot>("/analytics/snapshot", {
      demoFallback: fallback ? () => fallback : undefined,
    }),
};
