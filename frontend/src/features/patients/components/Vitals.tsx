import { ArrowDownRight, ArrowUpRight, Minus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { vitals } from "@/mocks";
import { cn } from "@/lib/utils";

export function Vitals() {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle>Vitals · last 24h</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-3 pb-5">
        {vitals.map((v) => (
          <div
            key={v.label}
            className="rounded-xl bg-surface-subtle border border-border/60 p-3"
          >
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{v.label}</span>
              {v.trend === "up" && <ArrowUpRight className="size-3 text-danger" />}
              {v.trend === "down" && <ArrowDownRight className="size-3 text-info" />}
              {v.trend === "flat" && <Minus className="size-3 text-muted-foreground" />}
            </div>
            <div className="mt-1 text-lg font-bold leading-none">
              {v.value}
              <span className="text-xs text-muted-foreground font-normal ml-1">{v.unit}</span>
            </div>
            <div
              className={cn(
                "mt-1 text-[10px] uppercase tracking-wider font-semibold",
                v.status === "normal" && "text-success",
                v.status === "elevated" && "text-warning",
                v.status === "low" && "text-info",
                v.status === "critical" && "text-danger"
              )}
            >
              {v.status}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
