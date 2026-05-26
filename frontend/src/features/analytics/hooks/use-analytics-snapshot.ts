import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/features/analytics/api/analytics-api";
import { QUERY_KEYS } from "@/config/constants";
import { bottlenecks, complicationTrend, promsTrend, heatmapData } from "@/mocks";

export function useAnalyticsSnapshot() {
  return useQuery({
    queryKey: QUERY_KEYS.analytics.snapshot,
    queryFn: () =>
      analyticsApi.snapshot({
        kpis: [
          { label: "Total patients", value: 598, delta: 2.4 },
          { label: "Ready for OR", value: 12, delta: 1.1 },
          { label: "High-risk", value: 8, delta: -0.3 },
          { label: "Confirmed appts", value: 64, delta: 4.2 },
        ],
        bottlenecks: bottlenecks.map((b) => ({
          name: b.name,
          percent_affected: b.percent,
          trend: b.trend,
          direction: b.direction,
          impact: b.impact,
          suggested_fix: b.fix,
        })),
        complication_trend: complicationTrend.map((c) => ({
          label: c.label,
          value: (c as { value?: number }).value ?? null,
        })),
        proms_trend: promsTrend.map((p) => ({
          label: p.label,
          series: {
            satisfaction: Number(p.satisfaction),
            mobility: Number(p.mobility),
            pain: Number(p.pain),
          },
        })),
        heatmap: heatmapData.map((h) => ({ body_part: h.body, values: h.values })),
      }),
    staleTime: 5 * 60_000,
  });
}
