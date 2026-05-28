import { ClipboardList, ListTodo, Loader2, CheckCircle2 } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { useTasks } from "./hooks/use-tasks";
import type { PatientTask } from "./api/tasks-api";

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-warning/10 text-warning",
  submitted: "bg-info/10 text-info",
  new: "bg-warning/10 text-warning",
  in_progress: "bg-info/10 text-info",
  completed: "bg-success/10 text-success",
  cancelled: "bg-muted text-muted-foreground",
  denied: "bg-danger/10 text-danger",
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
};

function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1);
}

export function TasksPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useTasks();

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Forms to complete and follow-ups from your care team."
      />

      {isLoading && (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load tasks"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && data && (
        <div className="max-w-3xl">
          {data.items.length === 0 ? (
            <Empty
              icon={<CheckCircle2 className="size-5" />}
              title="You're all caught up"
              description="There's nothing waiting on you right now. We'll let you know when there is."
            />
          ) : (
            <Card className="divide-y divide-border">
              {data.items.map((t) => (
                <TaskRow key={`${t.kind}-${t.id}`} task={t} />
              ))}
            </Card>
          )}
        </div>
      )}
    </>
  );
}

function TaskRow({ task }: { task: PatientTask }) {
  const isForm = task.kind === "form";
  const statusClass = STATUS_STYLES[task.status] ?? "bg-muted text-muted-foreground";
  return (
    <div className="flex items-start gap-3 px-5 py-4 first:rounded-t-2xl last:rounded-b-2xl">
      <div
        className={cn(
          "size-10 rounded-xl grid place-items-center shrink-0",
          isForm ? "bg-warning/10 text-warning" : "bg-primary/10 text-primary"
        )}
      >
        {isForm ? <ClipboardList className="size-4" /> : <ListTodo className="size-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="text-sm font-semibold text-foreground">{task.title}</div>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider",
              statusClass
            )}
          >
            {statusLabel(task.status)}
          </span>
        </div>
        {task.description && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
            {task.description}
          </p>
        )}
        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
          {task.due_date && <span>Due {formatDate(task.due_date)}</span>}
          {task.requested_by && <span>From {task.requested_by}</span>}
        </div>
      </div>
    </div>
  );
}
