import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { CalendarCheck, Users, AlertTriangle, Percent } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/utils";
import { ReportPageShell, KpiCard, defaultRange } from "../components";
import type { DateRange } from "../components";
import { useAppointmentReport } from "../hooks/use-appointment-report";

const STATUS_COLORS: Record<string, string> = {
  completed: "#10b981",
  cancelled: "#f59e0b",
  no_show: "#ef4444",
  scheduled: "#4f46e5",
};

const PIE_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4"];

function fmtDate(iso: string) {
  return formatDate(iso, { day: "2-digit", month: "short" });
}

function statusVariant(s: string): "success" | "warning" | "danger" | "secondary" {
  if (s === "completed") return "success";
  if (s === "cancelled") return "warning";
  if (s === "no-show" || s === "no_show") return "danger";
  return "secondary";
}

export function AppointmentsReportPage() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const { data, isLoading } = useAppointmentReport(range);

  const exportProps = data
    ? {
        filename: `appointments-${range.start}-to-${range.end}.csv`,
        headers: ["Date", "Patient", "Provider", "Type", "Status", "Duration (min)"],
        rows: data.rows.map((r) => [
          fmtDate(r.starts_at),
          r.patient_name,
          r.provider_name ?? "",
          r.type ?? "",
          r.status,
          r.duration_minutes ?? "",
        ]),
      }
    : undefined;

  return (
    <ReportPageShell
      title="Appointments"
      subtitle="Volume, status, and no-show trends"
      range={range}
      onRangeChange={setRange}
      isLoading={isLoading}
      exportProps={exportProps}
      kpis={
        <>
          <KpiCard label="Total" value={data?.total ?? "—"} icon={CalendarCheck} />
          <KpiCard
            label="Completed"
            value={data?.completed ?? "—"}
            icon={Users}
            tone="success"
          />
          <KpiCard
            label="No-shows"
            value={data?.no_show ?? "—"}
            icon={AlertTriangle}
            tone="danger"
          />
          <KpiCard
            label="Show rate"
            value={data ? `${data.show_rate}%` : "—"}
            icon={Percent}
            tone={
              data
                ? data.show_rate >= 80
                  ? "success"
                  : data.show_rate >= 60
                  ? "warning"
                  : "danger"
                : "default"
            }
          />
        </>
      }
    >
      {/* Stacked bar by day */}
      <Card>
        <CardHeader>
          <CardTitle>Daily appointment status</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data?.series ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => fmtDate(v)}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
              <Tooltip labelFormatter={(l) => fmtDate(l as string)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="completed" stackId="a" fill={STATUS_COLORS.completed} name="Completed" radius={[0, 0, 0, 0]} />
              <Bar dataKey="scheduled" stackId="a" fill={STATUS_COLORS.scheduled} name="Scheduled" />
              <Bar dataKey="cancelled" stackId="a" fill={STATUS_COLORS.cancelled} name="Cancelled" />
              <Bar dataKey="no_show" stackId="a" fill={STATUS_COLORS.no_show} name="No-show" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* By type pie */}
      <Card>
        <CardHeader>
          <CardTitle>Breakdown by type</CardTitle>
        </CardHeader>
        <CardContent className="flex justify-center">
          <ResponsiveContainer width="100%" height={240}>
            <PieChart>
              <Pie
                data={data?.by_type ?? []}
                dataKey="count"
                nameKey="type"
                cx="50%"
                cy="50%"
                outerRadius={90}
                label={({ name, percent }: { name: string; percent: number }) =>
                  `${name} ${(percent * 100).toFixed(0)}%`
                }
                labelLine={false}
              >
                {(data?.by_type ?? []).map((_entry, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(v: number, n: string) => [v, n]} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Appointment rows table */}
      <Card>
        <CardHeader>
          <CardTitle>Appointment list</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground text-left">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Patient</th>
                  <th className="px-4 py-2.5 font-medium">Provider</th>
                  <th className="px-4 py-2.5 font-medium">Type</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                  <th className="px-4 py-2.5 font-medium text-right">Duration</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(data?.rows ?? []).map((r) => (
                  <tr key={r.id} className="hover:bg-surface-subtle transition">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(r.starts_at)}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{r.patient_name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {r.provider_name ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">
                      {r.type ?? "—"}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={statusVariant(r.status)} size="sm">
                        {r.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right text-muted-foreground">
                      {r.duration_minutes != null ? `${r.duration_minutes} min` : "—"}
                    </td>
                  </tr>
                ))}
                {!isLoading && !data?.rows.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No appointments in this period
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </ReportPageShell>
  );
}
