import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  MoreVertical,
  Phone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpcomingAppointments } from "@/features/appointments/hooks/use-upcoming-appointments";
import { cn } from "@/lib/utils";

const days = Array.from({ length: 18 }).map((_, i) => 14 + i);

export function UpcomingAppointments() {
  const { data, isLoading } = useUpcomingAppointments(8);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3 gap-2 flex-wrap">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="size-8 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <Calendar className="size-4" />
          </span>
          Upcoming appointments
        </CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Legend color="bg-primary" label="Available slots" />
          <Legend color="bg-slate-900" label="Selected" />
          <Legend color="bg-slate-200" label="Unavailable" />
          <button className="text-sm font-medium text-primary hover:underline ml-2">
            View more
          </button>
        </div>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="flex items-center gap-1.5 mb-5 overflow-x-auto scrollbar-hide">
          <Button variant="ghost" size="icon" className="size-9 shrink-0">
            <ChevronLeft className="size-4" />
          </Button>
          {days.map((d) => (
            <button
              key={d}
              className={cn(
                "size-10 rounded-full text-[13px] font-semibold shrink-0 transition border",
                d === 22
                  ? "bg-primary text-white border-primary shadow-glow"
                  : "bg-white border-border text-foreground hover:bg-primary/5"
              )}
            >
              {d}
            </button>
          ))}
          <Button variant="ghost" size="icon" className="size-9 shrink-0">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground text-left">
                <Th>Patient</Th>
                <Th>Treatment</Th>
                <Th>Status</Th>
                <Th>Date</Th>
                <Th>Time</Th>
                <th className="font-medium py-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="py-2">
                      <Skeleton className="h-10 rounded-xl" />
                    </td>
                  </tr>
                ))}
              {!isLoading &&
                data?.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-subtle transition">
                    <td className="py-3.5">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={a.patientName} size="md" />
                        <span className="font-semibold text-[14px]">
                          {a.patientName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 capitalize text-foreground/80">{a.type}</td>
                    <td className="py-3.5">
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
                    <td className="py-3.5 text-foreground/80">{a.date}</td>
                    <td className="py-3.5 text-foreground/80">{a.time}</td>
                    <td className="py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" className="size-9 rounded-full">
                          <Phone className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-9">
                          <MoreVertical className="size-4" />
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

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="font-medium py-3">
      <button className="inline-flex items-center gap-1 hover:text-foreground transition">
        {children}
        <ChevronsUpDown className="size-3 opacity-60" />
      </button>
    </th>
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
