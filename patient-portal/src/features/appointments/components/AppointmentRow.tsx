import { CalendarClock, MapPin, Stethoscope } from "lucide-react";
import { Card } from "@/components/ui/card";
import { humanWhen } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { PatientAppointment } from "@/features/appointments/api/appointments-api";

const STATUS_STYLES: Record<string, string> = {
  scheduled: "bg-info/10 text-info",
  confirmed: "bg-success/10 text-success",
  pending: "bg-warning/10 text-warning",
  completed: "bg-muted text-muted-foreground",
  cancelled: "bg-danger/10 text-danger",
  "no-show": "bg-danger/10 text-danger",
};

export function AppointmentRow({ appt }: { appt: PatientAppointment }) {
  const statusClass = STATUS_STYLES[appt.status] ?? "bg-muted text-muted-foreground";
  const typeLabel =
    appt.type.charAt(0).toUpperCase() + appt.type.slice(1).replace("-", " ");
  return (
    <Card className="p-5">
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <CalendarClock className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-base font-bold tabular-nums">
              {humanWhen(appt.starts_at)}
            </div>
            <span
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
                statusClass
              )}
            >
              {appt.status}
            </span>
          </div>
          <div className="text-sm text-muted-foreground mt-1">
            {typeLabel} · {appt.duration_minutes} min
            {appt.provider_name && (
              <>
                {" · "}with {appt.provider_name}
                {appt.provider_specialty ? ` (${appt.provider_specialty})` : ""}
              </>
            )}
          </div>
          {(appt.room || appt.reason) && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground mt-2">
              {appt.room && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="size-3.5" />
                  {appt.room}
                </span>
              )}
              {appt.reason && (
                <span className="inline-flex items-center gap-1.5">
                  <Stethoscope className="size-3.5" />
                  {appt.reason}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
