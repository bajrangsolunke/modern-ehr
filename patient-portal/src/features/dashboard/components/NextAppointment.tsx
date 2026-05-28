import { useNavigate } from "react-router-dom";
import { CalendarClock, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { humanWhen } from "@/lib/datetime";
import type { DashboardNextAppointment } from "@/features/dashboard/api/dashboard-api";

export function NextAppointment({ appt }: { appt: DashboardNextAppointment | null }) {
  const navigate = useNavigate();
  return (
    <Card className="h-full p-6 flex flex-col">
      <div className="flex items-start gap-4 flex-1">
        <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <CalendarClock className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Next appointment
          </div>
          {appt ? (
            <>
              <div className="text-lg font-bold tabular-nums">
                {humanWhen(appt.starts_at)}
              </div>
              {appt.provider_name && (
                <div className="text-sm text-muted-foreground mt-0.5">
                  with {appt.provider_name}
                  {appt.specialty ? ` · ${appt.specialty}` : ""}
                </div>
              )}
              {appt.location && (
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-2">
                  <MapPin className="size-3.5" />
                  {appt.location}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="text-lg font-bold">None scheduled</div>
              <p className="text-sm text-muted-foreground mt-1">
                When your provider schedules a visit, it'll appear here.
              </p>
            </>
          )}
        </div>
      </div>
      <div className="pt-4 mt-auto">
        <Button
          size="sm"
          variant={appt ? "default" : "secondary"}
          onClick={() => navigate("/appointments")}
        >
          {appt ? "View details" : "See all appointments"}
        </Button>
      </div>
    </Card>
  );
}
