import {
  Bell,
  CalendarClock,
  ClipboardList,
  FileText,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SummaryTile } from "@/components/ui/summary-tile";
import { useDashboard } from "./hooks/use-dashboard";
import { Greeting } from "./components/Greeting";
import { NextAppointment } from "./components/NextAppointment";
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

  const upcomingCount = data.next_appointment ? 1 : 0;
  const todoCount = data.pending_actions.total;
  const messageCount = data.recent_message ? 1 : 0;
  const docsCount = data.recent_documents.length;

  return (
    <div className="space-y-6 max-w-6xl">
      <Greeting firstName={data.greeting.first_name} />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3">
        <SummaryTile
          label="Upcoming visits"
          value={upcomingCount}
          icon={<CalendarClock />}
          tone="primary"
        />
        <SummaryTile
          label="To do"
          value={todoCount}
          icon={<ClipboardList />}
          tone={todoCount > 0 ? "warning" : "success"}
        />
        <SummaryTile
          label="New messages"
          value={messageCount}
          icon={<MessageCircle />}
          tone="info"
        />
        <SummaryTile
          label="Recent docs"
          value={docsCount}
          icon={<FileText />}
          tone="success"
        />
      </div>

      <div className="grid gap-4 lg:gap-5 lg:grid-cols-2">
        <Section title="Next appointment">
          {data.next_appointment ? (
            <NextAppointment appt={data.next_appointment} />
          ) : (
            <Empty
              icon={<CalendarClock className="size-5" />}
              title="No upcoming appointment"
              description="When your provider schedules a visit, it'll appear here."
            />
          )}
        </Section>

        <Section title="Things to do">
          <ActionsCard
            total={data.pending_actions.total}
            forms={data.pending_actions.forms_count}
            tasks={data.pending_actions.tasks_count}
          />
        </Section>

        <Section title="Latest message">
          {data.recent_message ? (
            <RecentMessage msg={data.recent_message} />
          ) : (
            <Empty
              icon={<MessageCircle className="size-5" />}
              title="No messages yet"
              description="When your care team writes to you, it'll appear here."
            />
          )}
        </Section>

        <Section title="Updates">
          <Card className="p-6">
            <div className="flex items-start gap-4">
              <div className="size-12 rounded-2xl bg-info/10 text-info grid place-items-center shrink-0">
                <Bell className="size-5" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
                  Notifications
                </div>
                <div className="text-base font-semibold">
                  Check your activity feed
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  Recent updates from your appointments, messages, and care plan.
                </p>
                <div className="mt-4">
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => (window.location.href = "/notifications")}
                  >
                    Open notifications
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </Section>
      </div>

      <Section title="Recent documents">
        <RecentDocuments docs={data.recent_documents} />
      </Section>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function ActionsCard({
  total,
  forms,
  tasks,
}: {
  total: number;
  forms: number;
  tasks: number;
}) {
  if (total === 0) {
    return (
      <Card className="p-6 border-primary/30 bg-primary/5">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-full bg-primary/15 text-primary grid place-items-center">
            <ClipboardList className="size-5" />
          </div>
          <div>
            <div className="font-semibold text-foreground">All caught up</div>
            <div className="text-sm text-muted-foreground">
              No pending actions right now.
            </div>
          </div>
        </div>
      </Card>
    );
  }
  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-2xl bg-warning/10 text-warning grid place-items-center shrink-0">
          <ClipboardList className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Things to do
          </div>
          <div className="text-lg font-bold">
            You have {total} {total === 1 ? "item" : "items"}
          </div>
          <div className="text-sm text-muted-foreground mt-0.5">
            {forms} {forms === 1 ? "form" : "forms"} · {tasks}{" "}
            {tasks === 1 ? "task" : "tasks"}
          </div>
          <div className="mt-4">
            <Button
              size="sm"
              onClick={() => (window.location.href = "/tasks")}
            >
              Open your list
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
