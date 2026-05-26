import { ChevronDown, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/layout/PageHeader";
import { ComplicationBars } from "@/components/charts/ComplicationBars";
import { PromsLines } from "@/components/charts/PromsLines";
import { DelayLine } from "@/components/charts/DelayLine";
import { RiskHeatmap } from "@/components/charts/RiskHeatmap";
import { ReadinessStack } from "@/components/charts/ReadinessStack";
import { bottlenecks, phaseBottlenecks } from "@/data/mock";
import { cn } from "@/lib/utils";

const filters = [
  { label: "Last 30 days" },
  { label: "Knees" },
  { label: "Team B" },
  { label: "All patients" },
  { label: "Orthopedics & Trauma Surgery" },
];

export function InsightsPage() {
  return (
    <>
      <PageHeader
        title="Insights"
        subtitle="Trends · Operational + clinical analytics powered by AI"
        right={
          <div className="flex items-center gap-2 flex-wrap">
            {filters.map((f) => (
              <Button key={f.label} variant="secondary" size="sm">
                {f.label}
                <ChevronDown className="size-3 opacity-60" />
              </Button>
            ))}
            <Button variant="ghost" size="sm">
              <RotateCcw className="size-3.5" />
              Reset
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle>Complication rate over time</CardTitle>
            <PillToggle options={["3 days", "3 month", "1 year"]} active="3 month" />
          </CardHeader>
          <CardContent className="pb-5">
            <ComplicationBars />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Complications heatmap</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <RiskHeatmap />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>PROMs trend</CardTitle>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                <Legend color="bg-primary" label="Satisfaction" />
                <Legend color="bg-primary/60" label="Mobility" />
                <Legend color="bg-primary/40" label="Pain" />
              </div>
            </div>
            <PillToggle options={["3 month", "1 year"]} active="3 month" />
          </CardHeader>
          <CardContent className="pb-5">
            <PromsLines />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Procedure start delay trend</CardTitle>
              <div className="flex items-center gap-3 mt-1 text-[11px] text-muted-foreground">
                <Legend color="bg-danger" label="Goals" />
                <Legend color="bg-primary" label="Avg. delay (min)" />
              </div>
            </div>
            <PillToggle options={["3 month", "1 year"]} active="3 month" />
          </CardHeader>
          <CardContent className="pb-5">
            <DelayLine />
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <div>
              <CardTitle>Checklist phase bottleneck table</CardTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Show: 2 of 5 completed</p>
            </div>
          </CardHeader>
          <CardContent className="pb-5">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-muted-foreground text-left">
                    <th className="font-medium py-2">Checklist phase</th>
                    <th className="font-medium py-2">% Late</th>
                    <th className="font-medium py-2">Avg. Delay</th>
                    <th className="font-medium py-2">Most affected dept</th>
                    <th className="font-medium py-2">Suggested action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {phaseBottlenecks.map((r) => (
                    <tr key={r.phase}>
                      <td className="py-2">
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              "size-4 rounded-full border-2 grid place-items-center text-[10px]",
                              r.completed
                                ? "bg-primary border-primary text-white"
                                : "border-border"
                            )}
                          >
                            {r.completed && "✓"}
                          </span>
                          <span className="text-xs font-medium">{r.phase}</span>
                        </div>
                      </td>
                      <td className="py-2 text-xs">{r.late}</td>
                      <td className="py-2 text-xs">{r.avgDelay}</td>
                      <td className="py-2 text-xs">{r.department}</td>
                      <td className="py-2 text-xs text-primary">{r.action}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle>Readiness completion timing</CardTitle>
          </CardHeader>
          <CardContent className="pb-5">
            <ReadinessStack />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle>Top bottlenecks summary</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground text-left">
                  <th className="font-medium py-2">Bottleneck</th>
                  <th className="font-medium py-2">% Affected</th>
                  <th className="font-medium py-2">Trend vs. Last month</th>
                  <th className="font-medium py-2">Impact</th>
                  <th className="font-medium py-2">Suggested fix</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {bottlenecks.map((b, i) => (
                  <motion.tr
                    key={b.name}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <td className="py-3 font-medium">{b.name}</td>
                    <td className="py-3 text-muted-foreground">{b.percent}</td>
                    <td className="py-3">
                      <Badge
                        variant={b.direction === "up" ? "danger" : "success"}
                        size="sm"
                      >
                        {b.direction === "up" ? "↑" : "↓"} {b.trend}
                      </Badge>
                    </td>
                    <td className="py-3 text-muted-foreground">{b.impact}</td>
                    <td className="py-3 text-primary">{b.fix}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

function PillToggle({ options, active }: { options: string[]; active: string }) {
  return (
    <div className="inline-flex items-center bg-secondary rounded-full p-0.5">
      {options.map((o) => (
        <button
          key={o}
          className={cn(
            "px-3 py-1 text-xs font-medium rounded-full transition",
            o === active
              ? "bg-white text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      <span>{label}</span>
    </div>
  );
}
