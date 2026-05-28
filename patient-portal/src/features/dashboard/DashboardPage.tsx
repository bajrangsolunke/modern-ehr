import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { Spinner } from "@/components/ui/Spinner";
import { Card } from "@/components/ui/Card";
import { Greeting } from "./components/Greeting";
import { NextAppointment } from "./components/NextAppointment";
import { Actions } from "./components/Actions";
import { RecentMessage } from "./components/RecentMessage";
import { RecentDocuments } from "./components/RecentDocuments";

export function DashboardPage() {
  const { data, isLoading, isError, refetch } = useDashboard();

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Spinner className="size-6 text-primary" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <Card className="text-center space-y-3">
        <div className="font-semibold">Couldn't load your dashboard</div>
        <p className="text-muted text-sm">Pull-to-refresh or try again.</p>
        <button
          onClick={() => refetch()}
          className="text-primary text-sm font-semibold underline"
        >
          Try again
        </button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Greeting firstName={data.greeting.first_name} />
      {data.next_appointment && <NextAppointment appt={data.next_appointment} />}
      <Actions data={data.pending_actions} />
      {data.recent_message && <RecentMessage msg={data.recent_message} />}
      <RecentDocuments docs={data.recent_documents} />
    </div>
  );
}
