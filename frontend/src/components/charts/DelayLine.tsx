import {
  Area,
  AreaChart,
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { procedureDelayTrend } from "@/data/mock";

export function DelayLine() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <AreaChart data={procedureDelayTrend} margin={{ left: -20, right: 8, top: 8 }}>
        <defs>
          <linearGradient id="delay" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#4F8CFF" stopOpacity={0.3} />
            <stop offset="100%" stopColor="#4F8CFF" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#E6EEF9" vertical={false} />
        <XAxis
          dataKey="label"
          axisLine={false}
          tickLine={false}
          style={{ fontSize: 10, fill: "#6B7280" }}
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
        <ReferenceLine y={15} stroke="#EF4444" strokeDasharray="4 4" />
        <Area
          type="monotone"
          dataKey="delay"
          stroke="#4F8CFF"
          strokeWidth={2.5}
          fill="url(#delay)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
