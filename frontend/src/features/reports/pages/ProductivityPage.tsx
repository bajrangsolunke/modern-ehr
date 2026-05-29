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
import { Gauge, Users, FileText, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReportPageShell, KpiCard, defaultRange } from "../components";
import type { DateRange } from "../components";
import { useProductivityReport } from "../hooks/use-productivity-report";

export function ProductivityPage() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const [sortKey, setSortKey] = useState<
    "appointments_completed" | "notes_signed" | "avg_duration_minutes" | "no_show_count"
  >("appointments_completed");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const { data, isLoading } = useProductivityReport(range);

  function toggleSort(k: typeof sortKey) {
    if (sortKey === k) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(k);
      setSortDir("desc");
    }
  }

  const sorted = [...(data?.providers ?? [])].sort((a, b) => {
    const va = a[sortKey];
    const vb = b[sortKey];
    return sortDir === "desc" ? vb - va : va - vb;
  });

  const totalCompleted = (data?.providers ?? []).reduce(
    (s, p) => s + p.appointments_completed,
    0
  );
  const totalNotes = (data?.providers ?? []).reduce((s, p) => s + p.notes_signed, 0);
  const avgDur =
    data && data.providers.length > 0
      ? (
          data.providers.reduce((s, p) => s + p.avg_duration_minutes, 0) /
          data.providers.length
        ).toFixed(1)
      : "—";

  const exportProps = data
    ? {
        filename: `productivity-${range.start}-to-${range.end}.csv`,
        headers: [
          "Provider",
          "Specialty",
          "Completed Appts",
          "Notes Signed",
          "Avg Duration (min)",
          "No-shows",
        ],
        rows: data.providers.map((p) => [
          p.provider_name,
          p.specialty ?? "",
          p.appointments_completed,
          p.notes_signed,
          p.avg_duration_minutes,
          p.no_show_count,
        ]),
      }
    : undefined;

  const SortIcon = ({ k }: { k: typeof sortKey }) =>
    sortKey === k ? (
      <span className="ml-1 text-primary">{sortDir === "desc" ? "↓" : "↑"}</span>
    ) : (
      <span className="ml-1 text-muted-foreground/40">↕</span>
    );

  return (
    <ReportPageShell
      title="Productivity"
      subtitle="Per-provider appointment completions and note-signing"
      range={range}
      onRangeChange={setRange}
      isLoading={isLoading}
      exportProps={exportProps}
      kpis={
        <>
          <KpiCard label="Providers" value={data?.providers.length ?? "—"} icon={Users} />
          <KpiCard
            label="Total completed"
            value={totalCompleted || "—"}
            icon={Gauge}
            tone="success"
          />
          <KpiCard label="Notes signed" value={totalNotes || "—"} icon={FileText} />
          <KpiCard label="Avg duration" value={avgDur === "—" ? "—" : `${avgDur} min`} icon={Clock} />
        </>
      }
    >
      {/* Chart: completed appts per provider */}
      <Card>
        <CardHeader>
          <CardTitle>Appointments completed per provider</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart
              data={data?.providers ?? []}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="provider_name"
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: string) =>
                  v.split(" ").map((p) => p[0]).join(". ") + "."
                }
              />
              <YAxis tick={{ fontSize: 11 }} tickLine={false} axisLine={false} width={32} />
              <Tooltip
                formatter={(v: number, n: string) => [v, n]}
                labelFormatter={(l) => String(l)}
              />
              <Bar
                dataKey="appointments_completed"
                fill="#4f46e5"
                radius={[4, 4, 0, 0]}
                name="Completed"
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Sortable table */}
      <Card>
        <CardHeader>
          <CardTitle>Provider breakdown</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground text-left">
                  <th className="px-4 py-2.5 font-medium">Provider</th>
                  <th className="px-4 py-2.5 font-medium">Specialty</th>
                  <th
                    className="px-4 py-2.5 font-medium text-right cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort("appointments_completed")}
                  >
                    Completed <SortIcon k="appointments_completed" />
                  </th>
                  <th
                    className="px-4 py-2.5 font-medium text-right cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort("notes_signed")}
                  >
                    Notes <SortIcon k="notes_signed" />
                  </th>
                  <th
                    className="px-4 py-2.5 font-medium text-right cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort("avg_duration_minutes")}
                  >
                    Avg dur. <SortIcon k="avg_duration_minutes" />
                  </th>
                  <th
                    className="px-4 py-2.5 font-medium text-right cursor-pointer hover:text-foreground"
                    onClick={() => toggleSort("no_show_count")}
                  >
                    No-shows <SortIcon k="no_show_count" />
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {sorted.map((p) => (
                  <tr key={p.provider_id} className="hover:bg-surface-subtle transition">
                    <td className="px-4 py-2.5 font-medium">{p.provider_name}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {p.specialty ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">{p.appointments_completed}</td>
                    <td className="px-4 py-2.5 text-right">{p.notes_signed}</td>
                    <td className="px-4 py-2.5 text-right">
                      {p.avg_duration_minutes > 0
                        ? `${p.avg_duration_minutes} min`
                        : "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {p.no_show_count > 0 ? (
                        <span className="text-rose-600 font-medium">{p.no_show_count}</span>
                      ) : (
                        "0"
                      )}
                    </td>
                  </tr>
                ))}
                {!isLoading && !data?.providers.length && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No provider data for this period
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
