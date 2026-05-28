import { useMemo, useState } from "react";
import {
  CheckCircle2,
  ClipboardList,
  Loader2,
  ListTodo,
  Pencil,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { SummaryTile } from "@/components/ui/summary-tile";
import { SortableTh, TABLE_ROW_BG } from "@/components/ui/sortable-th";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  FilterPopover,
  FilterHeader,
  FilterGroup,
} from "@/components/ui/filter-popover";
import { FilterChip } from "@/components/ui/filter-chip";
import { formatDate } from "@/lib/utils";
import { useCompleteTask, useTasks } from "./hooks/use-tasks";
import { FormFillModal } from "./components/FormFillModal";
import type { PatientTask, PatientTaskKind } from "./api/tasks-api";

const STATUS_VARIANT: Record<
  string,
  "info" | "success" | "warning" | "neutral" | "danger"
> = {
  pending: "warning",
  submitted: "info",
  new: "warning",
  in_progress: "info",
  completed: "success",
  cancelled: "neutral",
  denied: "danger",
};

const STATUS_LABEL: Record<string, string> = {
  in_progress: "In progress",
};

function statusLabel(s: string): string {
  return STATUS_LABEL[s] ?? s.charAt(0).toUpperCase() + s.slice(1);
}

type KindFilter = "any" | PatientTaskKind;
type StatusFilter = "any" | "pending" | "in_progress" | "submitted";
type DueFilter = "any" | "overdue" | "today" | "7d" | "no-date";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "any", label: "Any" },
  { value: "pending", label: "Pending" },
  { value: "in_progress", label: "In progress" },
  { value: "submitted", label: "Submitted" },
];

function isOverdue(due: string): boolean {
  return new Date(due) < new Date(new Date().setHours(0, 0, 0, 0));
}
function isToday(due: string): boolean {
  const d = new Date(due);
  const now = new Date();
  return (
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  );
}
function inNextDays(due: string, days: number): boolean {
  const d = new Date(due);
  const start = new Date(new Date().setHours(0, 0, 0, 0));
  const end = new Date(start);
  end.setDate(end.getDate() + days);
  return d >= start && d <= end;
}

export function TasksPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useTasks();
  const complete = useCompleteTask();
  const [formId, setFormId] = useState<string | null>(null);
  const [confirmTaskId, setConfirmTaskId] = useState<string | null>(null);

  const [kindFilter, setKindFilter] = useState<KindFilter>("any");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("any");
  const [dueFilter, setDueFilter] = useState<DueFilter>("any");

  const filtered = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((t) => {
      if (kindFilter !== "any" && t.kind !== kindFilter) return false;
      // "pending" matches both pending (forms) and new (tasks); "in_progress"
      // matches the task in_progress; "submitted" matches the form state.
      if (statusFilter !== "any") {
        if (statusFilter === "pending") {
          if (t.status !== "pending" && t.status !== "new") return false;
        } else if (t.status !== statusFilter) {
          return false;
        }
      }
      if (dueFilter !== "any") {
        if (dueFilter === "no-date") {
          if (t.due_date) return false;
        } else if (!t.due_date) {
          return false;
        } else if (dueFilter === "overdue" && !isOverdue(t.due_date)) {
          return false;
        } else if (dueFilter === "today" && !isToday(t.due_date)) {
          return false;
        } else if (dueFilter === "7d" && !inNextDays(t.due_date, 7)) {
          return false;
        }
      }
      return true;
    });
  }, [data, kindFilter, statusFilter, dueFilter]);

  const overdueCount = useMemo(() => {
    const items = data?.items ?? [];
    return items.filter((t) => t.due_date && isOverdue(t.due_date)).length;
  }, [data]);

  const activeFilterCount =
    (kindFilter !== "any" ? 1 : 0) +
    (statusFilter !== "any" ? 1 : 0) +
    (dueFilter !== "any" ? 1 : 0);

  return (
    <>
      <PageHeader
        title="Tasks"
        subtitle="Forms to complete and follow-ups from your care team."
        right={
          <FilterPopover
            activeCount={activeFilterCount}
            renderBody={(close) => (
              <>
                <FilterHeader
                  onClear={() => {
                    setKindFilter("any");
                    setStatusFilter("any");
                    setDueFilter("any");
                    close();
                  }}
                />
                <FilterGroup label="Type">
                  <FilterChip
                    label="Any"
                    active={kindFilter === "any"}
                    onClick={() => setKindFilter("any")}
                  />
                  <FilterChip
                    label="Forms"
                    active={kindFilter === "form"}
                    onClick={() => setKindFilter("form")}
                  />
                  <FilterChip
                    label="Tasks"
                    active={kindFilter === "task"}
                    onClick={() => setKindFilter("task")}
                  />
                </FilterGroup>
                <FilterGroup label="Status">
                  {STATUS_OPTIONS.map((s) => (
                    <FilterChip
                      key={s.value}
                      label={s.label}
                      active={statusFilter === s.value}
                      onClick={() => setStatusFilter(s.value)}
                    />
                  ))}
                </FilterGroup>
                <FilterGroup label="Due">
                  <FilterChip
                    label="Any"
                    active={dueFilter === "any"}
                    onClick={() => setDueFilter("any")}
                  />
                  <FilterChip
                    label="Overdue"
                    active={dueFilter === "overdue"}
                    onClick={() => setDueFilter("overdue")}
                  />
                  <FilterChip
                    label="Today"
                    active={dueFilter === "today"}
                    onClick={() => setDueFilter("today")}
                  />
                  <FilterChip
                    label="Next 7 days"
                    active={dueFilter === "7d"}
                    onClick={() => setDueFilter("7d")}
                  />
                  <FilterChip
                    label="No due date"
                    active={dueFilter === "no-date"}
                    onClick={() => setDueFilter("no-date")}
                  />
                </FilterGroup>
              </>
            )}
          />
        }
      />

      {!isLoading && !isError && data && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3 mb-3">
          <SummaryTile
            label="Total"
            value={data.total}
            icon={<ListTodo />}
            tone="primary"
          />
          <SummaryTile
            label="Forms"
            value={data.forms_count}
            icon={<ClipboardList />}
            tone="warning"
          />
          <SummaryTile
            label="Tasks"
            value={data.tasks_count}
            icon={<ListTodo />}
            tone="info"
          />
          <SummaryTile
            label="Overdue"
            value={overdueCount}
            icon={<CheckCircle2 />}
            tone={overdueCount > 0 ? "danger" : "success"}
          />
        </div>
      )}

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
        <>
          {filtered.length === 0 ? (
            <Empty
              icon={<CheckCircle2 className="size-5" />}
              title={
                activeFilterCount > 0
                  ? "No items match these filters"
                  : "You're all caught up"
              }
              description={
                activeFilterCount > 0
                  ? "Try widening the filters or clearing them."
                  : "There's nothing waiting on you right now. We'll let you know when there is."
              }
            />
          ) : (
            <Card className="overflow-hidden p-3 sm:p-4">
              <div className="overflow-x-auto">
                <table
                  className="w-full text-sm border-separate"
                  style={{ borderSpacing: "0 6px" }}
                >
                  <thead>
                    <tr className="text-xs text-muted-foreground text-left">
                      <SortableTh first>Item</SortableTh>
                      <SortableTh>Type</SortableTh>
                      <SortableTh>Status</SortableTh>
                      <SortableTh>Due</SortableTh>
                      <SortableTh>From</SortableTh>
                      <SortableTh last>{""}</SortableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((t) => (
                      <TaskRow
                        key={`${t.kind}-${t.id}`}
                        task={t}
                        completing={complete.isPending && confirmTaskId === t.id}
                        onComplete={() => setConfirmTaskId(t.id)}
                        onOpenForm={() => setFormId(t.id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      <FormFillModal formId={formId} onClose={() => setFormId(null)} />

      <ConfirmDialog
        open={Boolean(confirmTaskId)}
        onOpenChange={(o) => !o && setConfirmTaskId(null)}
        title="Mark this task complete?"
        description="Your care team will see that you've finished it."
        confirmLabel="Mark complete"
        busy={complete.isPending}
        onConfirm={() => {
          if (!confirmTaskId) return;
          complete.mutate(confirmTaskId, {
            onSuccess: () => setConfirmTaskId(null),
          });
        }}
      />
    </>
  );
}

interface RowProps {
  task: PatientTask;
  completing: boolean;
  onComplete: () => void;
  onOpenForm: () => void;
}

function TaskRow({ task, completing, onComplete, onOpenForm }: RowProps) {
  const isForm = task.kind === "form";
  const statusVariant = STATUS_VARIANT[task.status] ?? "neutral";
  const overdue = task.due_date ? isOverdue(task.due_date) : false;

  return (
    <tr className="hover:[&_td]:bg-[#EEF2F8] transition">
      <td
        className="px-4 py-2 first:rounded-l-full"
        style={{ background: TABLE_ROW_BG }}
      >
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={
              "size-9 rounded-xl grid place-items-center shrink-0 " +
              (isForm
                ? "bg-warning/10 text-warning"
                : "bg-primary/10 text-primary")
            }
          >
            {isForm ? (
              <ClipboardList className="size-4" />
            ) : (
              <ListTodo className="size-4" />
            )}
          </div>
          <div className="min-w-0">
            <div className="font-semibold truncate">{task.title}</div>
            {task.description && (
              <div className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
                {task.description}
              </div>
            )}
          </div>
        </div>
      </td>
      <td className="px-4 py-2 text-foreground/80" style={{ background: TABLE_ROW_BG }}>
        {isForm ? "Form" : "Task"}
      </td>
      <td className="px-4 py-2" style={{ background: TABLE_ROW_BG }}>
        <Badge variant={statusVariant} size="sm">
          {statusLabel(task.status)}
        </Badge>
      </td>
      <td
        className="px-4 py-2 tabular-nums"
        style={{ background: TABLE_ROW_BG }}
      >
        {task.due_date ? (
          <span className={overdue ? "text-danger font-semibold" : "text-foreground/80"}>
            {formatDate(task.due_date)}
            {overdue && (
              <span className="ml-1 text-[10px] uppercase tracking-wider">
                Overdue
              </span>
            )}
          </span>
        ) : (
          <span className="text-muted-foreground italic">—</span>
        )}
      </td>
      <td className="px-4 py-2 text-foreground/80" style={{ background: TABLE_ROW_BG }}>
        {task.requested_by ?? (
          <span className="text-muted-foreground italic">Care team</span>
        )}
      </td>
      <td
        className="px-4 py-2 last:rounded-r-full text-right"
        style={{ background: TABLE_ROW_BG }}
      >
        {isForm ? (
          <Button size="sm" variant="secondary" onClick={onOpenForm}>
            <Pencil className="size-4" />
            {task.status === "submitted" ? "Review" : "Fill out"}
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={onComplete}
            disabled={completing}
          >
            {completing ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <CheckCircle2 className="size-4" />
            )}
            Complete
          </Button>
        )}
      </td>
    </tr>
  );
}
