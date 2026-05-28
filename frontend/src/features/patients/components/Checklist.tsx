/**
 * Care plan checklist for the patient chart. Backed by patient-scoped
 * tasks from the existing tasks API. Tasks are grouped by category so
 * the list reads like a real checklist (e.g., "Documents · 2 of 3").
 * Provider can toggle a task complete inline; clicking the row opens
 * the existing TaskDetailsModal for the full view.
 */
import { useMemo, useState } from "react";
import { CheckCircle2, ClipboardList, Loader2, Plus } from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useTasks, useUpdateTask } from "@/features/tasks/hooks/use-tasks";
import { TaskDetailsModal } from "@/features/tasks/components/TaskDetailsModal";
import { TaskDrawer } from "@/features/tasks/components/TaskDrawer";
import { CATEGORY_LABEL } from "@/features/tasks/utils";
import type { Task, TaskCategory } from "@/features/tasks/api/tasks-api";
import { cn, pct } from "@/lib/utils";

interface Props {
  patientId: string;
}

export function ChecklistCard({ patientId }: Props) {
  const {
    data: page,
    isLoading,
    isError,
    error,
    refetch,
  } = useTasks({ patient_id: patientId, page_size: 100 });
  const update = useUpdateTask();
  const [viewing, setViewing] = useState<Task | null>(null);
  const [drawerTask, setDrawerTask] = useState<Task | undefined>(undefined);
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Memoise so groupByCategory only re-runs when the actual items
  // array reference changes (not every render).
  const tasks = useMemo<Task[]>(() => page?.items ?? [], [page?.items]);

  // Group tasks by category, preserving the order categories first
  // appear in. Each group tracks totals + completed count for the
  // progress bar.
  const groups = useMemo(() => groupByCategory(tasks), [tasks]);
  const totalCompleted = tasks.filter((t) => t.status === "completed").length;
  const overallPct = tasks.length ? pct(totalCompleted, tasks.length) : 0;

  const toggleComplete = (task: Task) => {
    const nextStatus =
      task.status === "completed" ? "in_progress" : "completed";
    update.mutate({ id: task.id, input: { status: nextStatus } });
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <div className="min-w-0">
            <CardTitle>Care plan checklist</CardTitle>
            {tasks.length > 0 && (
              <p className="text-xs text-muted-foreground mt-0.5">
                {totalCompleted} of {tasks.length} tasks complete · {overallPct}%
              </p>
            )}
          </div>
          <Button
            size="sm"
            onClick={() => {
              setDrawerTask(undefined);
              setDrawerOpen(true);
            }}
          >
            <Plus className="size-3.5" /> Add task
          </Button>
        </CardHeader>
        <CardContent className="pb-5 space-y-4">
          {isLoading && (
            <div className="flex items-center gap-2 justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Loading care plan…
            </div>
          )}

          {isError && !isLoading && (
            <ErrorBanner
              title="Couldn't load care plan"
              message={
                error instanceof Error ? error.message : "Please try again."
              }
              onRetry={() => refetch()}
            />
          )}

          {!isLoading && !isError && tasks.length === 0 && (
            <Empty
              icon={<ClipboardList className="size-6" />}
              title="No tasks yet"
              description="Add the first care-plan task for this patient — e.g. pre-op clearance, documents, lab orders."
              action={
                <Button
                  size="sm"
                  onClick={() => {
                    setDrawerTask(undefined);
                    setDrawerOpen(true);
                  }}
                >
                  <Plus className="size-3.5" /> Add task
                </Button>
              }
            />
          )}

          {!isLoading && !isError && tasks.length > 0 && (
            <div className="space-y-4">
              {groups.map((group) => {
                const done = group.completed === group.total;
                return (
                  <section
                    key={group.category}
                    className="rounded-xl border border-border/60 bg-surface-subtle/40 p-3"
                  >
                    <header className="flex items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-semibold text-sm">
                          {CATEGORY_LABEL[group.category]}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {group.completed} of {group.total} complete
                        </span>
                      </div>
                      <Badge
                        variant={done ? "success" : "warning"}
                        size="sm"
                        dot
                      >
                        {done ? "Done" : "In progress"}
                      </Badge>
                    </header>

                    {!done && (
                      <div className="mb-2">
                        <Progress value={pct(group.completed, group.total)} />
                      </div>
                    )}

                    <ul className="space-y-1">
                      {group.tasks.map((task) => (
                        <li key={task.id}>
                          <ChecklistRow
                            task={task}
                            onToggle={() => toggleComplete(task)}
                            onOpen={() => setViewing(task)}
                            toggling={
                              update.isPending &&
                              update.variables?.id === task.id
                            }
                          />
                        </li>
                      ))}
                    </ul>
                  </section>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <TaskDetailsModal
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        task={viewing}
        onEdit={(t) => {
          setViewing(null);
          setDrawerTask(t);
          setDrawerOpen(true);
        }}
      />

      <TaskDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setDrawerTask(undefined);
        }}
        task={drawerTask}
        audience="patients"
      />
    </>
  );
}

interface RowProps {
  task: Task;
  onToggle: () => void;
  onOpen: () => void;
  toggling: boolean;
}

function ChecklistRow({ task, onToggle, onOpen, toggling }: RowProps) {
  const done = task.status === "completed";
  return (
    <div className="group flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-white/50 transition">
      <button
        type="button"
        onClick={onToggle}
        disabled={toggling}
        aria-label={done ? "Mark as in progress" : "Mark complete"}
        className="shrink-0"
      >
        <CheckCircle2
          className={cn(
            "size-5 transition",
            done
              ? "text-primary fill-primary/20"
              : "text-muted-foreground hover:text-primary",
          )}
        />
      </button>
      <button
        type="button"
        onClick={onOpen}
        className={cn(
          "flex-1 min-w-0 text-left text-sm truncate",
          done && "line-through text-muted-foreground",
        )}
      >
        {task.title}
      </button>
    </div>
  );
}

interface CategoryGroup {
  category: TaskCategory;
  tasks: Task[];
  total: number;
  completed: number;
}

function groupByCategory(tasks: Task[]): CategoryGroup[] {
  const byCat = new Map<TaskCategory, Task[]>();
  for (const t of tasks) {
    const arr = byCat.get(t.category) ?? [];
    arr.push(t);
    byCat.set(t.category, arr);
  }
  return Array.from(byCat.entries()).map(([category, items]) => ({
    category,
    tasks: items,
    total: items.length,
    completed: items.filter((t) => t.status === "completed").length,
  }));
}
