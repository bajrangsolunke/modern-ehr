import { useState } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { DollarSign, TrendingUp, TrendingDown, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { formatCurrency, formatDate } from "@/lib/utils";
import { ReportPageShell, KpiCard, defaultRange } from "../components";
import type { DateRange } from "../components";
import { usePaymentReport } from "../hooks/use-payment-report";

function fmtDate(iso: string) {
  return formatDate(iso, { day: "2-digit", month: "short" });
}

function statusTone(s: string) {
  if (s === "succeeded") return "success";
  if (s === "failed") return "danger";
  return "warning";
}

export function PaymentsPage() {
  const [range, setRange] = useState<DateRange>(defaultRange);
  const { data, isLoading } = usePaymentReport(range);

  const exportProps = data
    ? {
        filename: `payments-${range.start}-to-${range.end}.csv`,
        headers: ["Date", "Patient", "Method", "Amount", "Status"],
        rows: data.transactions.map((t) => [
          fmtDate(t.created_at),
          t.patient_name,
          t.method ?? "",
          t.amount,
          t.status,
        ]),
      }
    : undefined;

  return (
    <ReportPageShell
      title="Payments"
      subtitle="Collections, refunds, and outstanding A/R"
      range={range}
      onRangeChange={setRange}
      isLoading={isLoading}
      exportProps={exportProps}
      kpis={
        <>
          <KpiCard
            label="Gross collected"
            value={formatCurrency(data?.gross_collected)}
            icon={DollarSign}
          />
          <KpiCard
            label="Refunds"
            value={formatCurrency(data?.refunds)}
            icon={TrendingDown}
            tone="warning"
          />
          <KpiCard
            label="Net collected"
            value={formatCurrency(data?.net_collected)}
            icon={TrendingUp}
            tone="success"
          />
          <KpiCard
            label="Transactions"
            value={data?.transaction_count ?? "—"}
            icon={Hash}
          />
        </>
      }
    >
      {/* Daily collections chart */}
      <Card>
        <CardHeader>
          <CardTitle>Daily collections</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data?.series ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="grossGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="netGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis
                dataKey="date"
                tickFormatter={(v) => fmtDate(v)}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  formatCurrency(v),
                  name.charAt(0).toUpperCase() + name.slice(1),
                ]}
                labelFormatter={(l) => fmtDate(l as string)}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area
                type="monotone"
                dataKey="gross"
                stroke="#4f46e5"
                strokeWidth={2}
                fill="url(#grossGrad)"
                name="Gross"
              />
              <Area
                type="monotone"
                dataKey="net"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#netGrad)"
                name="Net"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* A/R aging */}
      <Card>
        <CardHeader>
          <CardTitle>A/R aging buckets</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data?.ar_aging ?? []} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="bucket" tick={{ fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis
                tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
                tick={{ fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                width={48}
              />
              <Tooltip
                formatter={(v: number, name: string) => [
                  name === "total_outstanding" ? formatCurrency(v) : v,
                  name === "total_outstanding" ? "Outstanding" : "Patients",
                ]}
              />
              <Bar dataKey="total_outstanding" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Outstanding" />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Transactions table */}
      <Card>
        <CardHeader>
          <CardTitle>Transactions</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground text-left">
                  <th className="px-4 py-2.5 font-medium">Date</th>
                  <th className="px-4 py-2.5 font-medium">Patient</th>
                  <th className="px-4 py-2.5 font-medium">Method</th>
                  <th className="px-4 py-2.5 font-medium text-right">Amount</th>
                  <th className="px-4 py-2.5 font-medium">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {(data?.transactions ?? []).map((t) => (
                  <tr key={t.id} className="hover:bg-surface-subtle transition">
                    <td className="px-4 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                      {fmtDate(t.created_at)}
                    </td>
                    <td className="px-4 py-2.5 font-medium">{t.patient_name}</td>
                    <td className="px-4 py-2.5 capitalize text-muted-foreground">
                      {t.method ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-right font-medium">
                      {formatCurrency(t.amount)}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge variant={statusTone(t.status)} size="sm">
                        {t.status}
                      </Badge>
                    </td>
                  </tr>
                ))}
                {!isLoading && !data?.transactions.length && (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-muted-foreground text-sm">
                      No transactions in this period
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
