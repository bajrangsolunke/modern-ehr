import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { promsTrend } from "@/data/mock";

export function PromsLines() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={promsTrend} margin={{ left: -20, right: 8, top: 8 }}>
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
          style={{ fontSize: 10, fill: "#6B7280" }}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #E6EEF9",
            background: "white",
            boxShadow: "0 8px 24px rgba(17,24,39,0.08)",
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="satisfaction"
          stroke="#4F8CFF"
          strokeWidth={2.5}
          dot={{ r: 3, fill: "#4F8CFF" }}
        />
        <Line
          type="monotone"
          dataKey="mobility"
          stroke="#7AB2FF"
          strokeWidth={2}
          dot={{ r: 3, fill: "#7AB2FF" }}
        />
        <Line
          type="monotone"
          dataKey="pain"
          stroke="#94BAFF"
          strokeWidth={2}
          dot={{ r: 3, fill: "#94BAFF" }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
