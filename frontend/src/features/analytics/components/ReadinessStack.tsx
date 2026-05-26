import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { readinessTiming } from "@/mocks";

export function ReadinessStack() {
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={readinessTiming} margin={{ left: -20, right: 8, top: 8 }}>
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
        <Legend
          wrapperStyle={{ fontSize: 10, paddingTop: 8 }}
          iconType="circle"
          iconSize={8}
        />
        <Bar dataKey="ready" stackId="a" fill="#4F8CFF" name="Completely ready" />
        <Bar dataKey="partial" stackId="a" fill="#94BAFF" name="Partially ready" />
        <Bar
          dataKey="notReady"
          stackId="a"
          fill="#E6EEF9"
          name="Not ready"
          radius={[6, 6, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
