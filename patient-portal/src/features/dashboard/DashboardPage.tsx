import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useDashboard } from "./hooks/use-dashboard";
import { Greeting } from "./components/Greeting";
import { HeroAppointmentCard } from "./components/HeroAppointmentCard";
import { RecentMessage } from "./components/RecentMessage";
import { RecentDocuments } from "./components/RecentDocuments";
import { HealthMetricCard } from "./components/HealthMetricCard";
import { TrendChartCard } from "./components/TrendChartCard";
import { DiagnosisCard } from "./components/DiagnosisCard";
import { AIInsightsCard } from "./components/AIInsightsCard";
import { TasksWidget } from "./components/TasksWidget";
import { HealthJourneyTimeline } from "./components/HealthJourneyTimeline";

// 5-up vitals row: BP, HR, Glucose, plus O2 + Sleep placeholders for the
// premium dashboard reference. Missing metrics render empty placeholders.
const VITALS_SLOTS = [
  "blood_pressure",
  "heart_rate",
  "glucose",
  "oxygen_saturation",
  "sleep_score",
] as const;

const TREND_SLOTS = ["hemoglobin", "blood_pressure"] as const;

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

  const findMetric = (key: string) =>
    data.health_metrics.find((m) => m.metric === key);

  const unreadCount = data.recent_message ? 1 : 0;
  const upcomingCount = data.next_appointment ? 1 : 0;

  return (
    <div className="space-y-6 lg:space-y-7">
      <Greeting
        firstName={data.greeting.first_name}
        upcomingCount={upcomingCount}
        unreadCount={unreadCount}
      />

      {/* Hero appointment card — full width */}
      <HeroAppointmentCard appt={data.next_appointment} />

      {/* Vitals row — 5-up on xl, responsive down */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 lg:gap-4">
        {VITALS_SLOTS.map((key) => (
          <HealthMetricCard key={key} metricKey={key} metric={findMetric(key)} />
        ))}
      </div>

      {/* Asymmetric 12-col grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 lg:gap-6">
        {/* Left main column */}
        <div className="lg:col-span-8 space-y-5 lg:space-y-6 min-w-0">
          {/* AI insights — premium banner */}
          <AIInsightsCard />

          {/* Trend charts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
            {TREND_SLOTS.map((key) => (
              <TrendChartCard key={key} metricKey={key} metric={findMetric(key)} />
            ))}
          </div>

          {/* Documents + diagnosis */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 lg:gap-4">
            <div className="min-w-0">
              <RecentDocuments docs={data.recent_documents} />
            </div>
            <DiagnosisCard condition={data.primary_condition} />
          </div>
        </div>

        {/* Right rail */}
        <aside className="lg:col-span-4 space-y-5 lg:space-y-6">
          <TasksWidget
            total={data.pending_actions.total}
            forms={data.pending_actions.forms_count}
            tasks={data.pending_actions.tasks_count}
          />
          <RecentMessage msg={data.recent_message} />
          <HealthJourneyTimeline />
        </aside>
      </div>
    </div>
  );
}
