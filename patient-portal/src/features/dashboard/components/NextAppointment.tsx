import { CalendarClock, MapPin } from "lucide-react";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { humanWhen } from "@/lib/utils";
import { toast } from "@/lib/toast";
import type { DashboardNextAppointment } from "@/features/dashboard/api/dashboard-api";

export function NextAppointment({ appt }: { appt: DashboardNextAppointment }) {
  return (
    <Card>
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
            <CalendarClock className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
              Next appointment
            </div>
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
            <div className="mt-4">
              <Button
                size="sm"
                onClick={() => toast.info("Appointment details — coming soon")}
              >
                View details
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
