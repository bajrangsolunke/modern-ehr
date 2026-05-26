import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Cell,
} from "recharts";
import { complicationTrend } from "@/mocks";

export function ComplicationBars() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={complicationTrend} margin={{ left: -20, right: 8, top: 8 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#E6EEF9" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          style={{ fontSize: 10, fill: "#6B7280" }}
          interval={1}
        />
        <YAxis
          axisLine={false}
          tickLine={false}
          tickFormatter={(v) => `${v}%`}
          style={{ fontSize: 10, fill: "#6B7280" }}
        />
        <Tooltip
          cursor={{ fill: "rgba(79,140,255,0.06)" }}
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #E6EEF9",
            background: "white",
            boxShadow: "0 8px 24px rgba(17,24,39,0.08)",
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
          {complicationTrend.map((d, idx) => (
            <Cell
              key={idx}
              fill={d.label === "Mar W3" ? "#4F8CFF" : "#94BAFF"}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
