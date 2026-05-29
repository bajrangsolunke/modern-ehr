import { useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { Users, UserPlus, RefreshCw, Activity } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDate } from "@/lib/utils";
import { ReportPageShell, KpiCard, defaultRange } from "../components";
import type { DateRange } from "../components";
import { usePatientVolumeReport } from "../hooks/use-patient-volume-report";

const SEX_COLORS = ["#4f46e5", "#10b981", "#f59e0b", "#ef4444"];
const AGE_COLORS = ["#4f46e5", "#6366f1", "#818cf8", "#a5b4fc", "#c7d2fe"];

function fmtDate(iso: string) {
  return formatDate(iso, { day: "2-digit", month: "short" });
}

export function PatientVolumePage() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const { data, isLoading } = usePatientVolumeReport(range);

  const exportProps = data
    ? {
        filename: `patient-volume-${range.start}-to-${range.end}.csv`,
        headers: ["Date", "New Patients"],
        rows: data.series.map((p) => [fmtDate(p.date), p.new_patients]),
      }
    : undefined;

  return (
    <ReportPageShell
      title="Patient Volume"
      subtitle="New registrations and demographic breakdown"
      range={range}
      onRangeChange={setRange}
      isLoading={isLoading}
      exportProps={exportProps}
      kpis={
        <>
          <KpiCard label="Total active" value={data?.total_active ?? "—"} icon={Users} />
          <KpiCard
            label="New in period"
            value={data?.new_in_period ?? "—"}
            icon={UserPlus}
            tone="success"
          />
          <KpiCard
            label="Returning visits"
            value={data?.returning_in_period ?? "—"}
            icon={RefreshCw}
          />
          <KpiCard
            label="Avg new/day"
            value={
              data && data.series.length > 0
                ? (data.new_in_period / data.series.length).toFixed(1)
                : "—"
            }
            icon={Activity}
          />
        </>
      }
    >
      {/* New patients over time */}
      <Card>
        <CardHeader>
          <CardTitle>New patients per day</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={data?.series ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
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
              <Line
                type="monotone"
                dataKey="new_patients"
                stroke="#4f46e5"
                strokeWidth={2}
                dot={false}
                name="New patients"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* By sex */}
        <Card>
          <CardHeader>
            <CardTitle>By sex</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.by_sex ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Patients">
                  {(data?.by_sex ?? []).map((_e, i) => (
                    <Cell key={i} fill={SEX_COLORS[i % SEX_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* By age band */}
        <Card>
          <CardHeader>
            <CardTitle>By age band</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={data?.by_age_band ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
                <Tooltip />
                <Bar dataKey="count" radius={[4, 4, 0, 0]} name="Patients">
                  {(data?.by_age_band ?? []).map((_e, i) => (
                    <Cell key={i} fill={AGE_COLORS[i % AGE_COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </ReportPageShell>
  );
}
