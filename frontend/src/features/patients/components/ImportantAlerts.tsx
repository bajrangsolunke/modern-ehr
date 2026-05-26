import { AlertOctagon, Info, MoreVertical, Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const alerts = [
  {
    title: "Blood thinner",
    desc: "Apixaban: Pause confirmed 12.05.2025",
    color: "bg-danger/10 text-danger",
    icon: AlertOctagon,
  },
  { title: "DNR", desc: "Yes", color: "bg-warning/10 text-warning", icon: AlertOctagon },
  { title: "Lab tests", desc: "Update Hb/INR", color: "bg-info/10 text-info", icon: Info },
];

export function ImportantAlerts() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Important alerts</CardTitle>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" className="size-7">
            <Plus className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="size-7">
            <Info className="size-3.5" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-2.5 pb-5">
        {alerts.map((a) => (
          <div
            key={a.title}
            className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-surface-subtle transition group"
          >
            <div className={`size-8 rounded-full grid place-items-center ${a.color}`}>
              <a.icon className="size-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{a.title}</div>
              <div className="text-xs text-muted-foreground truncate">{a.desc}</div>
            </div>
            <Button variant="ghost" size="icon" className="size-7 opacity-0 group-hover:opacity-100">
              <MoreVertical className="size-3.5" />
            </Button>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
