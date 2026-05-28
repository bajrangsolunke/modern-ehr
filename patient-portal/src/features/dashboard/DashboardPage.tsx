import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useDashboard } from "./hooks/use-dashboard";
import { Greeting } from "./components/Greeting";
import { NextAppointment } from "./components/NextAppointment";
import { Actions } from "./components/Actions";
import { RecentMessage } from "./components/RecentMessage";
import { RecentDocuments } from "./components/RecentDocuments";

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboard();

  if (isLoading) {
    return (
      <div className="grid place-items-center py-16">
        <Loader2 className="size-6 animate-spin text-primary" />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorBanner
        title="Couldn't load your dashboard"
        message={error instanceof Error ? error.message : "Please try again."}
        onRetry={() => refetch()}
        retrying={isFetching}
      />
    );
  }

  if (!data) {
    return (
      <Card className="p-6 text-center space-y-3">
        <div className="font-semibold">No data yet</div>
        <Button variant="secondary" size="sm" onClick={() => refetch()}>
          Try again
        </Button>
      </Card>
    );
  }

  return (
    <div className="max-w-5xl">
      <Greeting firstName={data.greeting.first_name} />
      <div className="grid gap-4 md:grid-cols-2 mb-4">
        {data.next_appointment && <NextAppointment appt={data.next_appointment} />}
        <Actions data={data.pending_actions} />
        {data.recent_message && <RecentMessage msg={data.recent_message} />}
      </div>
      <RecentDocuments docs={data.recent_documents} />
    </div>
  );
}
