import { CalendarClock } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Empty } from "@/components/ui/empty";

export function AppointmentsPage() {
  return (
    <>
      <PageHeader
        title="Appointments"
        subtitle="Upcoming and past visits with your care team."
      />
      <Empty
        icon={<CalendarClock className="size-5" />}
        title="Appointments — coming soon"
        description="Your scheduled visits, reminders, and rescheduling tools will live here."
      />
    </>
  );
}
