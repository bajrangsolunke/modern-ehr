import { AlertOctagon, AlertTriangle, Info, MoreVertical, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { AiTag } from "@/components/ui/ai-tag";
import type { Alert } from "@/types";

const sevMap = {
  critical: { icon: AlertOctagon, bg: "bg-danger/10", color: "text-danger" },
  warning: { icon: AlertTriangle, bg: "bg-warning/10", color: "text-warning" },
  info: { icon: Info, bg: "bg-info/10", color: "text-info" },
  success: { icon: Info, bg: "bg-success/10", color: "text-success" },
} as const;

export function AlertCard({ alerts }: { alerts: Alert[] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Important alerts</CardTitle>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="size-7">
            <Sparkles className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7">
            <Info className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 pb-5">
        {alerts.map((a) => {
          const meta = sevMap[a.severity];
          const Icon = meta.icon;
          return (
            <div
              key={a.id}
              className="flex items-start gap-3 p-3 rounded-xl hover:bg-surface-subtle transition group"
            >
              <div className={cn("size-8 rounded-full grid place-items-center shrink-0", meta.bg)}>
                <Icon className={cn("size-4", meta.color)} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h4 className="font-semibold text-sm leading-tight">{a.title}</h4>
                  {a.source === "ai" && <AiTag />}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 leading-snug">
                  {a.message}
                </p>
                <p className="text-[11px] text-muted-foreground mt-1">{a.timestamp}</p>
              </div>
              <Button variant="ghost" size="icon" className="size-7 opacity-0 group-hover:opacity-100">
                <MoreVertical className="size-3.5" />
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
