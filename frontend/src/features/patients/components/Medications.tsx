import { Plus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { medications } from "@/mocks";

const statusMap = {
  active: "success",
  paused: "warning",
  discontinued: "neutral",
} as const;

export function MedicationsCard() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Medications</CardTitle>
        <Button size="sm" variant="soft">
          <Plus className="size-3.5" /> Add med
        </Button>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="space-y-2">
          {medications.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-3 rounded-xl bg-surface-subtle p-3"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{m.name}</span>
                  <Badge variant={statusMap[m.status]} dot size="sm" className="capitalize">
                    {m.status}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {m.dose} · {m.frequency} · {m.route}
                </div>
              </div>
              <div className="text-right text-xs text-muted-foreground shrink-0">
                {m.prescriber}
                <div className="text-[10px]">since {m.startDate}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
