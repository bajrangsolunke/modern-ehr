import { useDashboard } from "@/features/dashboard/hooks/use-dashboard";
import { Spinner } from "@/components/ui/Spinner";
import { Card, CardContent } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
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
      <Card>
        <CardContent className="p-6 text-center space-y-3">
          <div className="font-semibold">Couldn't load your dashboard</div>
          <p className="text-muted-foreground text-sm">Try again in a moment.</p>
          <Button variant="secondary" size="sm" onClick={() => refetch()}>
            Try again
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <Greeting firstName={data.greeting.first_name} />
      <div className="grid gap-4 md:grid-cols-2">
        {data.next_appointment && <NextAppointment appt={data.next_appointment} />}
        <Actions data={data.pending_actions} />
        {data.recent_message && <RecentMessage msg={data.recent_message} />}
      </div>
      <RecentDocuments docs={data.recent_documents} />
    </div>
  );
}
