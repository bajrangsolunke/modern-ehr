import { heatmapData } from "@/mocks";
import { cn } from "@/lib/utils";

const teams = ["Team A", "Team B", "Team C", "Team D", "Team E", "Team F"];

function intensityClass(v: number) {
  const map = [
    "bg-primary/5",
    "bg-primary/15",
    "bg-primary/30",
    "bg-primary/50",
    "bg-primary/70",
    "bg-primary",
  ];
  return map[Math.min(v, map.length - 1)];
}

export function RiskHeatmap() {
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[64px_repeat(6,1fr)] gap-1 mb-2 text-[10px] text-muted-foreground">
        <div />
        {teams.map((t) => (
          <div key={t} className="text-center">{t}</div>
        ))}
      </div>
      {heatmapData.map((row) => (
        <div key={row.body} className="grid grid-cols-[64px_repeat(6,1fr)] gap-1 items-center">
          <div className="text-xs text-muted-foreground">{row.body}</div>
          {row.values.map((v, i) => (
            <div
              key={i}
              className={cn(
                "h-8 rounded-md transition hover:scale-105 cursor-pointer",
                intensityClass(v)
              )}
            />
          ))}
        </div>
      ))}
      <div className="flex items-center justify-end gap-2 pt-2 text-[10px] text-muted-foreground">
        <span>Less</span>
        <div className="flex gap-0.5">
          {[0, 1, 2, 3, 4, 5].map((v) => (
            <div key={v} className={cn("h-3 w-3 rounded-sm", intensityClass(v))} />
          ))}
        </div>
        <span>More</span>
      </div>
    </div>
  );
}
