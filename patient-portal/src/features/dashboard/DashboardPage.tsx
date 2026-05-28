import { useNavigate } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  ClipboardList,
  FileText,
  Loader2,
  MessageCircle,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorBanner } from "@/components/ui/error-banner";
import { StatCard } from "@/components/ui/stat-card";
import { useDashboard } from "./hooks/use-dashboard";
import { Greeting } from "./components/Greeting";
import { NextAppointment } from "./components/NextAppointment";
import { RecentMessage } from "./components/RecentMessage";
import { RecentDocuments } from "./components/RecentDocuments";

export function DashboardPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboard();
  const navigate = useNavigate();

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

      {/* Top stat row — same shape as provider StatCard grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-5">
        <StatCard
          label="Upcoming visits"
          value={upcomingCount}
          icon={<CalendarClock />}
          accent="primary"
          hint={
            upcomingCount > 0 ? "1 visit scheduled" : "Nothing on the calendar"
          }
        />
        <StatCard
          label="To do"
          value={todoCount}
          icon={<ClipboardList />}
          accent={todoCount > 0 ? "warning" : "success"}
          hint={
            todoCount > 0
              ? `${data.pending_actions.forms_count} forms · ${data.pending_actions.tasks_count} tasks`
              : "All caught up"
          }
        />
        <StatCard
          label="New messages"
          value={messageCount}
          icon={<MessageCircle />}
          accent="info"
          hint={
            data.recent_message?.sender_name
              ? `From ${data.recent_message.sender_name}`
              : "No new replies"
          }
        />
        <StatCard
          label="Recent docs"
          value={docsCount}
          icon={<FileText />}
          accent="success"
          hint={docsCount > 0 ? "Shared by your care team" : "Nothing shared yet"}
        />
      </div>

      {/* Two-column equal-height row — cards stretch via grid + h-full */}
      <div className="grid gap-4 lg:gap-5 lg:grid-cols-2 items-stretch">
        <NextAppointment appt={data.next_appointment} />
        <ActionsCard
          total={data.pending_actions.total}
          forms={data.pending_actions.forms_count}
          tasks={data.pending_actions.tasks_count}
        />
        <RecentMessage msg={data.recent_message} />
        <UpdatesCard onOpen={() => navigate("/notifications")} />
      </div>

      <section className="space-y-3">
        <h2 className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
          Recent documents
        </h2>
        <RecentDocuments docs={data.recent_documents} />
      </section>
    </div>
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
  const navigate = useNavigate();
  return (
    <Card className="h-full p-6 flex flex-col">
      <div className="flex items-start gap-4 flex-1">
        <div
          className={
            "size-12 rounded-2xl grid place-items-center shrink-0 " +
            (total > 0
              ? "bg-warning/10 text-warning"
              : "bg-success/10 text-success")
          }
        >
          {total > 0 ? (
            <ClipboardList className="size-5" />
          ) : (
            <CheckCircle2 className="size-5" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Things to do
          </div>
          {total > 0 ? (
            <>
              <div className="text-lg font-bold">
                You have {total} {total === 1 ? "item" : "items"}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                {forms} {forms === 1 ? "form" : "forms"} · {tasks}{" "}
                {tasks === 1 ? "task" : "tasks"}
              </div>
            </>
          ) : (
            <>
              <div className="text-lg font-bold">All caught up</div>
              <p className="text-sm text-muted-foreground mt-1">
                No pending actions right now.
              </p>
            </>
          )}
        </div>
      </div>
      <div className="pt-4 mt-auto">
        <Button
          size="sm"
          variant={total > 0 ? "default" : "secondary"}
          onClick={() => navigate("/tasks")}
        >
          {total > 0 ? "Open your list" : "Go to Tasks"}
        </Button>
      </div>
    </Card>
  );
}

function UpdatesCard({ onOpen }: { onOpen: () => void }) {
  return (
    <Card className="h-full p-6 flex flex-col">
      <div className="flex items-start gap-4 flex-1">
        <div className="size-12 rounded-2xl bg-info/10 text-info grid place-items-center shrink-0">
          <Bell className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Updates
          </div>
          <div className="text-lg font-bold">Check your activity feed</div>
          <p className="text-sm text-muted-foreground mt-1">
            Recent updates from your appointments, messages, and care plan.
          </p>
        </div>
      </div>
      <div className="pt-4 mt-auto">
        <Button size="sm" variant="secondary" onClick={onOpen}>
          Open notifications
        </Button>
      </div>
    </Card>
  );
}
