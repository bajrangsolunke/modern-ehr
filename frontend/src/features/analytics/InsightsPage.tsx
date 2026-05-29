/**
 * InsightsPage — EHR operational snapshot backed by /reports/insights.
 * Replaces the orthopedic surgery demo.
 */
import { Link } from "react-router-dom";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  DollarSign,
  CalendarCheck,
  AlertTriangle,
  Stethoscope,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/layout/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency, formatDate } from "@/lib/utils";
import { useInsightsSnapshot } from "@/features/reports/hooks/use-insights-snapshot";
import { ROUTES } from "@/config/constants";

function fmtDate(iso: string) {
  return formatDate(iso, { day: "2-digit", month: "short" });
}

function riskBadgeVariant(level: string): "danger" | "warning" | "secondary" {
  if (level === "high" || level === "critical") return "danger";
  if (level === "moderate") return "warning";
  return "secondary";
}

function NoShowDelta({ current, prev }: { current: number; prev: number }) {
  const diff = current - prev;
  if (Math.abs(diff) < 0.1)
    return <span className="text-muted-foreground text-xs">same as prior 30d</span>;
  const up = diff > 0;
  return (
    <span className={`text-xs font-medium ${up ? "text-rose-600" : "text-emerald-600"}`}>
      {up ? "↑" : "↓"} {Math.abs(diff).toFixed(1)}% vs prior 30d
    </span>
  );
}

export function InsightsPage() {
  const { data, isLoading } = useInsightsSnapshot();

  return (
    <>
      <PageHeader title="Insights" subtitle="A live snapshot of your clinic today" />

      {/* KPI row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {/* Today's revenue */}
        <div className="rounded-2xl bg-white border border-border shadow-soft p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <DollarSign className="size-4 text-muted-foreground shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Revenue today
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <>
              <span className="text-2xl font-bold leading-none">
                {formatCurrency(data?.revenue_today.gross)}
              </span>
              <span className="text-[11px] text-muted-foreground">
                Net {formatCurrency(data?.revenue_today.net)} &middot;{" "}
                {data?.revenue_today.transaction_count ?? 0} transactions
              </span>
            </>
          )}
        </div>

        {/* Appointments today */}
        <div className="rounded-2xl bg-white border border-border shadow-soft p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <CalendarCheck className="size-4 text-muted-foreground shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Appointments today
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <>
              <span className="text-2xl font-bold leading-none">
                {data?.appointments_today.total ?? "—"}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {data?.appointments_today.completed ?? 0} done &middot;{" "}
                {data?.appointments_today.remaining ?? 0} remaining
              </span>
            </>
          )}
        </div>

        {/* No-show rate */}
        <div className="rounded-2xl bg-white border border-border shadow-soft p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="size-4 text-muted-foreground shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              No-show rate (30d)
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-24" />
          ) : (
            <>
              <span
                className={`text-2xl font-bold leading-none ${
                  (data?.no_show_rate_30d ?? 0) >= 15
                    ? "text-rose-600"
                    : (data?.no_show_rate_30d ?? 0) >= 10
                    ? "text-amber-600"
                    : "text-foreground"
                }`}
              >
                {data != null ? `${data.no_show_rate_30d}%` : "—"}
              </span>
              {data && (
                <NoShowDelta
                  current={data.no_show_rate_30d}
                  prev={data.no_show_rate_prev_30d}
                />
              )}
            </>
          )}
        </div>

        {/* Top diagnosis */}
        <div className="rounded-2xl bg-white border border-border shadow-soft p-4 flex flex-col gap-1">
          <div className="flex items-center gap-2 mb-1">
            <Stethoscope className="size-4 text-muted-foreground shrink-0" />
            <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Top diagnosis (30d)
            </span>
          </div>
          {isLoading ? (
            <Skeleton className="h-7 w-32" />
          ) : data?.top_diagnoses_30d[0] ? (
            <>
              <span className="text-sm font-bold leading-snug line-clamp-2">
                {data.top_diagnoses_30d[0].name}
              </span>
              <span className="text-[11px] text-muted-foreground">
                {data.top_diagnoses_30d[0].icd10
                  ? `${data.top_diagnoses_30d[0].icd10} · `
                  : ""}
                {data.top_diagnoses_30d[0].count} cases
              </span>
            </>
          ) : (
            <span className="text-muted-foreground text-sm">No data</span>
          )}
        </div>
      </div>

      {/* Revenue chart + Top diagnoses */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Revenue trend (last 30 days)</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-[220px] rounded-xl" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart
                  data={data?.monthly_revenue_series ?? []}
                  margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
                >
                  <defs>
                    <linearGradient id="insNetGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis
                    dataKey="date"
                    tickFormatter={(v) => fmtDate(v)}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 10 }}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip
                    formatter={(v: number) => [formatCurrency(v), "Net"]}
                    labelFormatter={(l) => fmtDate(l as string)}
                  />
                  <Area
                    type="monotone"
                    dataKey="net"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#insNetGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Top diagnoses (30 days)</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 rounded-lg" />
                ))}
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {(data?.top_diagnoses_30d ?? []).map((d, i) => (
                  <li key={i} className="flex items-center gap-3 px-4 py-3">
                    <span className="size-7 rounded-full bg-primary/10 text-primary text-xs font-bold grid place-items-center shrink-0">
                      {i + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{d.name}</p>
                      {d.icd10 && (
                        <p className="text-[11px] text-muted-foreground">{d.icd10}</p>
                      )}
                    </div>
                    <Badge variant="secondary" size="sm">
                      {d.count}
                    </Badge>
                  </li>
                ))}
                {!data?.top_diagnoses_30d.length && (
                  <li className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No diagnosis data
                  </li>
                )}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Risk patients */}
      <Card>
        <CardHeader className="pb-2 flex flex-row items-center justify-between">
          <CardTitle>At-risk patients</CardTitle>
          <Link to={ROUTES.patients} className="text-xs text-primary hover:underline">
            View all patients →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 rounded-xl" />
              ))}
            </div>
          ) : (
            <ul className="divide-y divide-border/60">
              {(data?.risk_patients ?? []).map((p) => (
                <li key={p.patient_id}>
                  <Link
                    to={`/patients/${p.patient_id}`}
                    className="flex items-center gap-3 px-4 py-3 hover:bg-surface-subtle transition"
                  >
                    <AlertCircle
                      className={`size-4 shrink-0 ${
                        p.risk_level === "high" || p.risk_level === "critical"
                          ? "text-rose-500"
                          : "text-amber-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{p.patient_name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{p.reason}</p>
                    </div>
                    <Badge variant={riskBadgeVariant(p.risk_level)} size="sm">
                      {p.risk_level}
                    </Badge>
                  </Link>
                </li>
              ))}
              {!data?.risk_patients.length && (
                <li className="px-4 py-8 text-center text-muted-foreground text-sm">
                  No high-risk patients flagged
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
