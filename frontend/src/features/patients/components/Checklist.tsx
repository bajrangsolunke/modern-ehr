import { CheckCircle2, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { checklist } from "@/mocks";
import { cn, pct } from "@/lib/utils";

export function ChecklistCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Care plan checklist</CardTitle>
        <Badge variant="neutral" size="sm">
          Read-only · backed by upcoming care-plan API
        </Badge>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="relative ml-2 pl-5 border-l-2 border-dashed border-border space-y-3">
          {checklist.map((c, idx) => {
            const done = c.status === "done";
            const progress = pct(c.completed, c.total);
            return (
              <div key={c.id} className="relative">
                <div className="absolute -left-[31px] top-1.5">
                  <CheckCircle2
                    className={cn(
                      "size-5 rounded-full bg-background",
                      done ? "text-primary fill-primary/20" : "text-primary",
                      idx === checklist.length - 1 && !done && "text-primary"
                    )}
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <ChevronDown className="size-3.5 text-muted-foreground" />
                    <span className="font-semibold text-sm">{c.label}</span>
                    <span className="text-xs text-muted-foreground">
                      Tasks: {c.completed} of {c.total} completed
                    </span>
                  </div>
                  <Badge variant={done ? "success" : "warning"} size="sm" dot>
                    {done ? "Done" : "In progress"}
                  </Badge>
                </div>
                {!done && (
                  <div className="mt-2 max-w-md">
                    <Progress value={progress} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
