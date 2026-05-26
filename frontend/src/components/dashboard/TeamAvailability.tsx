import { Phone, SlidersHorizontal } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { team } from "@/data/mock";

const availability = [
  { from: "09 AM", to: "19 PM" },
  { from: "08 AM", to: "18 PM" },
  { from: "10 AM", to: "20 PM" },
  { from: "09 AM", to: "17 PM" },
  { from: "08 AM", to: "16 PM" },
];

export function TeamAvailability() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle>Team availability on the day</CardTitle>
        <Button variant="ghost" size="icon" className="size-7">
          <SlidersHorizontal className="size-3.5" />
        </Button>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="space-y-3">
          {team.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center justify-between rounded-xl p-2.5 hover:bg-surface-subtle transition"
            >
              <div className="flex items-center gap-3 min-w-0">
                <UserAvatar name={m.name} size="md" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold truncate">{m.name}</div>
                  <div className="text-xs text-muted-foreground truncate">{m.specialty}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {availability[i % availability.length].from} – {availability[i % availability.length].to}
                  </div>
                </div>
              </div>
              <Button size="icon" variant="default" className="size-9 shrink-0">
                <Phone className="size-3.5" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
