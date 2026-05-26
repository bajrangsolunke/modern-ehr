import { motion } from "framer-motion";
import { Maximize2, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { teamGantt } from "@/data/mock";
import { cn } from "@/lib/utils";

const hours = [8, 9, 10, 11, 12, 13, 14, 15];
const colorMap: Record<string, string> = {
  surgery: "bg-primary text-white",
  consent: "bg-violet-300 text-violet-900",
  ward: "bg-sky-300 text-sky-900",
  break: "bg-amber-200 text-amber-900",
};

export function TeamGantt() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-4 flex-wrap">
          <CardTitle>Team Gantt</CardTitle>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <Legend color="bg-primary" label="Surgery" />
            <Legend color="bg-violet-300" label="Ward round" />
            <Legend color="bg-sky-300" label="Consent talk" />
            <Legend color="bg-amber-200" label="Break" />
          </div>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="size-7">
            <SlidersHorizontal className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7">
            <Maximize2 className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="overflow-x-auto">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[180px_repeat(8,1fr)] gap-1 mb-2 text-xs text-muted-foreground border-b border-border pb-2">
              <div className="font-medium">Doctors</div>
              {hours.map((h) => (
                <div key={h} className={cn("text-center", h === 10 && "text-primary font-semibold")}>
                  {h.toString().padStart(2, "0")}:00 {h < 12 ? "AM" : "PM"}
                </div>
              ))}
            </div>
            <div className="space-y-2">
              {teamGantt.map((row, idx) => (
                <div key={row.name} className="grid grid-cols-[180px_repeat(8,1fr)] gap-1 items-center h-10">
                  <div className="flex items-center gap-2 pr-2">
                    <UserAvatar name={row.name} size="sm" />
                    <div className="min-w-0">
                      <div className="text-xs font-semibold truncate">{row.name}</div>
                      <div className="text-[10px] text-muted-foreground truncate">{row.role}</div>
                    </div>
                  </div>
                  <div className="col-span-8 relative h-full bg-surface-subtle rounded-lg">
                    {row.blocks.map((b, i) => {
                      const startPct = ((b.start - 8) / 8) * 100;
                      const widthPct = ((b.end - b.start) / 8) * 100;
                      return (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: idx * 0.05 + i * 0.03 }}
                          className={cn(
                            "absolute top-1 bottom-1 rounded-md text-[10px] font-semibold flex items-center px-2 shadow-soft",
                            colorMap[b.type]
                          )}
                          style={{
                            left: `${startPct}%`,
                            width: `${widthPct}%`,
                          }}
                        >
                          <span className="truncate">{b.label}</span>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      <span>{label}</span>
    </div>
  );
}
