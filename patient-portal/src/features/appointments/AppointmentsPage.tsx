import { CalendarClock } from "lucide-react";
import { PlaceholderPage } from "@/components/PlaceholderPage";

export function AppointmentsPage() {
  return (
    <PlaceholderPage
      title="Appointments"
      description="Upcoming and past visits with your care team."
      icon={<CalendarClock />}
    />
  );
}
