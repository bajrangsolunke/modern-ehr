import { useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Stethoscope, FileText, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ReportPageShell, KpiCard, defaultRange } from "../components";
import type { DateRange } from "../components";
import { useClinicalReport } from "../hooks/use-clinical-report";

export function ClinicalPage() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const { data, isLoading } = useClinicalReport(range);

  const exportProps = data
    ? {
        filename: `clinical-${range.start}-to-${range.end}.csv`,
        headers: ["ICD-10", "Diagnosis", "Count"],
        rows: data.top_diagnoses.map((d) => [d.icd10 ?? "", d.name, d.count]),
      }
    : undefined;

  const top10 = (data?.top_diagnoses ?? []).slice(0, 10);

  return (
    <ReportPageShell
      title="Clinical"
      subtitle="Diagnosis frequency and encounter volume"
      range={range}
      onRangeChange={setRange}
      isLoading={isLoading}
      exportProps={exportProps}
      kpis={
        <>
          <KpiCard
            label="Encounters"
            value={data?.total_encounters ?? "—"}
            icon={FileText}
          />
          <KpiCard
            label="Distinct diagnoses"
            value={data?.distinct_diagnoses ?? "—"}
            icon={Stethoscope}
          />
          <KpiCard
            label="Top diagnosis"
            value={data?.top_diagnoses[0]?.name ?? "—"}
            icon={Hash}
          />
        </>
      }
    >
      {/* Top 10 horizontal bar chart */}
      <Card>
        <CardHeader>
          <CardTitle>Top 10 diagnoses</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={Math.max(200, top10.length * 36)}>
            <BarChart
              data={top10}
              layout="vertical"
              margin={{ top: 4, right: 40, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="name"
                width={180}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) =>
                  v.length > 24 ? `${v.substring(0, 22)}…` : v
                }
              />
              <Tooltip
                formatter={(v: number, _n: string, props: { payload?: { icd10?: string } }) => [
                  v,
                  props.payload?.icd10 ? `Count (${props.payload.icd10})` : "Count",
                ]}
              />
              <Bar dataKey="count" fill="#4f46e5" radius={[0, 4, 4, 0]} name="Cases" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Top 20 table */}
      <Card>
        <CardHeader>
          <CardTitle>Diagnosis table (top 20)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground text-left">
                  <th className="px-4 py-2.5 font-medium">ICD-10</th>
                  <th className="px-4 py-2.5 font-medium">Diagnosis</th>
                  <th className="px-4 py-2.5 font-medium text-right">Cases</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(data?.top_diagnoses ?? []).map((d, i) => (
                  <tr key={i} className="hover:bg-surface-subtle transition">
                    <td className="px-4 py-2.5">
                      {d.icd10 ? (
                        <Badge variant="secondary" size="sm">
                          {d.icd10}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{d.name}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{d.count}</td>
                  </tr>
                ))}
                {!isLoading && !data?.top_diagnoses.length && (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No diagnosis data for this period
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
