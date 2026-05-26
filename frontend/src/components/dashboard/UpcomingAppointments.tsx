import { ChevronLeft, ChevronRight, MoreVertical, Phone } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { appointments } from "@/data/mock";
import { cn } from "@/lib/utils";

const days = Array.from({ length: 16 }).map((_, i) => 14 + i);

export function UpcomingAppointments() {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2">
          <span className="size-7 rounded-xl bg-primary/10 grid place-items-center text-primary">
            📅
          </span>
          Upcoming appointments
        </CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Legend color="bg-primary" label="Available slots" />
          <Legend color="bg-slate-900" label="Selected" />
          <Legend color="bg-slate-200" label="Unavailable" />
          <Button variant="ghost" size="xs" className="text-primary">View more</Button>
        </div>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="flex items-center gap-2 mb-4 overflow-x-auto scrollbar-hide">
          <Button variant="ghost" size="icon" className="size-7 shrink-0">
            <ChevronLeft className="size-3.5" />
          </Button>
          {days.map((d) => (
            <button
              key={d}
              className={cn(
                "size-9 rounded-full text-xs font-semibold shrink-0 transition",
                d === 22
                  ? "bg-primary text-white shadow-glow"
                  : "bg-secondary text-muted-foreground hover:bg-primary/10 hover:text-primary"
              )}
            >
              {d}
            </button>
          ))}
          <Button variant="ghost" size="icon" className="size-7 shrink-0">
            <ChevronRight className="size-3.5" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground text-left">
                <th className="font-medium py-2">Patient</th>
                <th className="font-medium py-2">Treatment</th>
                <th className="font-medium py-2">Status</th>
                <th className="font-medium py-2">Date</th>
                <th className="font-medium py-2">Time</th>
                <th className="font-medium py-2 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {appointments.map((a) => (
                <tr key={a.id} className="hover:bg-surface-subtle transition">
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <UserAvatar name={a.patientName} size="sm" />
                      <span className="font-medium">{a.patientName}</span>
                    </div>
                  </td>
                  <td className="py-3 capitalize">{a.type}</td>
                  <td className="py-3">
                    <Badge
                      variant={
                        a.status === "confirmed"
                          ? "success"
                          : a.status === "cancelled"
                          ? "danger"
                          : "warning"
                      }
                      dot
                      size="sm"
                      className="capitalize"
                    >
                      {a.status}
                    </Badge>
                  </td>
                  <td className="py-3 text-muted-foreground">{a.date}</td>
                  <td className="py-3 text-muted-foreground">{a.time}</td>
                  <td className="py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="default" className="size-8">
                        <Phone className="size-3" />
                      </Button>
                      <Button variant="ghost" size="icon" className="size-8">
                        <MoreVertical className="size-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
