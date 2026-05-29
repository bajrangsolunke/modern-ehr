import { useNavigate } from "react-router-dom";
import { CalendarClock, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn, formatDate } from "@/lib/utils";
import { formatTime } from "@/lib/utils";
import type { DashboardAppointmentItem } from "../api/dashboard-api";

const STATUS_VARIANT: Record<string, "success" | "warning" | "info" | "neutral" | "danger"> = {
  completed:  "success",
  confirmed:  "info",
  scheduled:  "info",
  pending:    "warning",
  cancelled:  "danger",
  "no-show":  "neutral",
};

interface Props {
  appointments: DashboardAppointmentItem[];
}

export function AppointmentHistoryCard({ appointments }: Props) {
  const navigate = useNavigate();

  return (
    <Card className="p-5 flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Appointment History</h3>
        <button
          onClick={() => navigate("/appointments")}
          className="text-xs text-primary font-medium hover:underline flex items-center gap-0.5"
        >
          See all <ChevronRight className="size-3" />
        </button>
      </div>

      {appointments.length === 0 ? (
        <p className="text-sm text-muted-foreground py-2">No past appointments.</p>
      ) : (
        <ul className="space-y-2">
          {appointments.map((appt) => (
            <li
              key={appt.id}
              onClick={() => navigate("/appointments")}
              className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-secondary/60 cursor-pointer transition-colors group"
            >
              <div className="size-8 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                <CalendarClock className="size-3.5" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-xs font-semibold truncate capitalize">
                  {appt.appointment_type ?? "Appointment"}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  {formatDate(appt.starts_at)} · {formatTime(appt.starts_at)}
                </div>
              </div>
              <Badge
                variant={STATUS_VARIANT[appt.status] ?? "neutral"}
                size="sm"
                className="shrink-0"
              >
                {appt.status}
              </Badge>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
