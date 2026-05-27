/**
 * Tasks workqueue — US-TASK-1..6
 * (docs/superpowers/specs/2026-05-27-workflow-user-stories.md).
 */
import { useMemo, useState } from "react";
import { ChevronDown, Filter, MoreVertical, Plus, Search } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { FilterChip } from "@/components/ui/filter-chip";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAuthStore } from "@/stores/auth-store";
import {
  useDeleteTask,
  useTasks,
  useUpdateTask,
} from "./hooks/use-tasks";
import { TaskDrawer } from "./components/TaskDrawer";
import { TaskDetailsModal } from "./components/TaskDetailsModal";
import {
  CATEGORIES,
  CATEGORY_LABEL,
  PRIORITIES,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUSES,
  STATUS_LABEL,
  STATUS_TONE,
  taskIdLabel,
} from "./utils";
import type {
  Task,
  TaskCategory,
  TaskPriority,
  TaskScope,
  TaskStatus,
} from "./api/tasks-api";
import { cn, formatDate } from "@/lib/utils";

export function TasksPage() {
  const currentUser = useAuthStore((s) => s.user);
  const canModify =
    currentUser?.role === "provider" ||
    currentUser?.role === "admin" ||
    currentUser?.role === "staff";

  const [scope, setScope] = useState<TaskScope>("all");
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [status, setStatus] = useState<TaskStatus | undefined>();
  const [priority, setPriority] = useState<TaskPriority | undefined>();
  const [category, setCategory] = useState<TaskCategory | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editing, setEditing] = useState<Task | null>(null);
  const [viewing, setViewing] = useState<Task | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Task | null>(null);

  const filters = useMemo(
    () => ({
      scope,
      q: debouncedQuery || undefined,
      status,
      priority,
      category,
      page,
      page_size: pageSize,
    }),
    [scope, debouncedQuery, status, priority, category, page, pageSize]
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useTasks(filters);
  const update = useUpdateTask();
  const remove = useDeleteTask();

  const activeFilterCount = (priority ? 1 : 0) + (category ? 1 : 0);

  const openCreate = () => {
    setEditing(null);
    setDrawerOpen(true);
  };
  const openEdit = (t: Task) => {
    setEditing(t);
    setDrawerOpen(true);
  };
  const openView = (t: Task) => setViewing(t);

  // Re-resolve the viewed task from the live list cache so optimistic
  // status / priority flips show up inside the modal without a refetch.
  // Falls back to the snapshot if the task isn't on the current page.
  const liveViewing = useMemo(() => {
    if (!viewing) return null;
    return data?.items.find((t) => t.id === viewing.id) ?? viewing;
  }, [viewing, data]);

  return (
    <>
      <PageHeader
        title="Tasks"
        right={
          <>
            <HeaderSearch value={query} onChange={setQuery} />
            <StatusDropdown value={status} onChange={setStatus} />
            <FilterPopover
              activeCount={activeFilterCount}
              renderBody={(close) => (
                <FilterPopoverBody
                  priority={priority}
                  setPriority={(p) => {
                    setPriority(p);
                    setPage(1);
                  }}
                  category={category}
                  setCategory={(c) => {
                    setCategory(c);
                    setPage(1);
                  }}
                  onClear={() => {
                    setPriority(undefined);
                    setCategory(undefined);
                    setPage(1);
                    close();
                  }}
                />
              )}
            />
            {canModify && (
              <Button className="h-10" onClick={openCreate}>
                <Plus className="size-4" /> Assign Task
              </Button>
            )}
          </>
        }
      />

      <ScopeTabs
        scope={scope}
        onChange={(s) => {
          setScope(s);
          setPage(1);
        }}
      />

      {isLoading && <TableSkeleton rows={8} cols={10} />}

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
          {data.items.length === 0 ? (
            <EmptyState canCreate={canModify} onCreate={openCreate} />
          ) : (
            <TaskTable
              items={data.items}
              onView={openView}
              onEdit={openEdit}
              onStatusChange={(t, next) =>
                update.mutate({ id: t.id, input: { status: next } })
              }
              onDelete={(t) => setPendingDelete(t)}
              canModify={canModify}
            />
          )}

          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            shown={data.items.length}
            noun="task"
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            onChange={setPage}
          />
        </>
      )}

      <TaskDetailsModal
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        task={liveViewing}
        onEdit={(t) => {
          setViewing(null);
          openEdit(t);
        }}
        onDelete={(t) => {
          setViewing(null);
          setPendingDelete(t);
        }}
        canModify={canModify}
      />

      <TaskDrawer
        open={drawerOpen}
        onOpenChange={(open) => {
          setDrawerOpen(open);
          if (!open) setEditing(null);
        }}
        task={editing ?? undefined}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={pendingDelete ? `Delete "${pendingDelete.title}"?` : "Delete task?"}
        description="This permanently removes the task. The audit log will keep a record."
        confirmLabel="Delete"
        destructive
        busy={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* Scope tabs                                                                 */
/* -------------------------------------------------------------------------- */

function ScopeTabs({
  scope,
  onChange,
}: {
  scope: TaskScope;
  onChange: (s: TaskScope) => void;
}) {
  const tabs: { value: TaskScope; label: string }[] = [
    { value: "all", label: "All Tasks" },
    { value: "mine", label: "My Tasks" },
    { value: "assigned", label: "Assigned" },
  ];
  return (
    <div className="inline-flex items-center gap-1 bg-white border border-border rounded-full p-1 shadow-soft mb-3">
      {tabs.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => onChange(t.value)}
          aria-pressed={scope === t.value}
          className={cn(
            "h-8 px-4 rounded-full text-sm font-medium transition",
            scope === t.value
              ? "bg-primary-gradient text-white shadow-glow"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

function TaskTable({
  items,
  onView,
  onEdit,
  onStatusChange,
  onDelete,
  canModify,
}: {
  items: Task[];
  /** Clicking the title (or row) opens the read-focused view modal. */
  onView: (t: Task) => void;
  /** Kebab → Edit opens the drawer directly. */
  onEdit: (t: Task) => void;
  onStatusChange: (t: Task, next: TaskStatus) => void;
  onDelete: (t: Task) => void;
  canModify: boolean;
}) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-[10px] uppercase tracking-wider text-muted-foreground font-semibold border-b border-border bg-surface-subtle">
              <th className="px-4 py-2.5">Task ID</th>
              <th className="px-3 py-2.5">Task</th>
              <th className="px-3 py-2.5">Category</th>
              <th className="px-3 py-2.5">Created By</th>
              <th className="px-3 py-2.5">Created Date</th>
              <th className="px-3 py-2.5">Assigned To</th>
              <th className="px-3 py-2.5">Due Date</th>
              <th className="px-3 py-2.5">Priority</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5 w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {items.map((t) => (
              <tr key={t.id} className="hover:bg-surface-subtle transition">
                <td className="px-4 py-3 align-top">
                  <span className="text-xs font-mono text-muted-foreground tabular-nums">
                    {taskIdLabel(t.id)}
                  </span>
                </td>
                <td className="px-3 py-3 align-top max-w-[280px]">
                  <button
                    type="button"
                    onClick={() => onView(t)}
                    className="text-left ring-focus"
                  >
                    <div className="text-sm font-semibold text-primary truncate hover:underline">
                      {t.title}
                    </div>
                    {t.description && (
                      <div className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                        {t.description}
                      </div>
                    )}
                  </button>
                </td>
                <td className="px-3 py-3 align-top">
                  <span className="text-xs">{CATEGORY_LABEL[t.category]}</span>
                </td>
                <td className="px-3 py-3 align-top">
                  <span className="text-xs">
                    {t.createdByName ?? "System"}
                  </span>
                </td>
                <td className="px-3 py-3 align-top">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatDate(t.createdAt)}
                  </span>
                </td>
                <td className="px-3 py-3 align-top">
                  <span
                    className={cn(
                      "text-xs",
                      t.assignedToName
                        ? "font-medium"
                        : "text-muted-foreground italic"
                    )}
                  >
                    {t.assignedToName ?? "Unassigned"}
                  </span>
                </td>
                <td className="px-3 py-3 align-top">
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {t.dueDate ? formatDate(t.dueDate) : "—"}
                  </span>
                </td>
                <td className="px-3 py-3 align-top">
                  <Badge
                    className={cn(
                      "border-transparent",
                      PRIORITY_TONE[t.priority]
                    )}
                  >
                    {PRIORITY_LABEL[t.priority]}
                  </Badge>
                </td>
                <td className="px-3 py-3 align-top">
                  <Badge
                    className={cn("border-transparent", STATUS_TONE[t.status])}
                  >
                    {STATUS_LABEL[t.status]}
                  </Badge>
                </td>
                <td className="px-3 py-3 align-top">
                  {canModify && (
                    <RowMenu
                      task={t}
                      onView={() => onView(t)}
                      onEdit={() => onEdit(t)}
                      onStatusChange={(next) => onStatusChange(t, next)}
                      onDelete={() => onDelete(t)}
                    />
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function RowMenu({
  task,
  onView,
  onEdit,
  onStatusChange,
  onDelete,
}: {
  task: Task;
  onView: () => void;
  onEdit: () => void;
  onStatusChange: (next: TaskStatus) => void;
  onDelete: () => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Task actions"
          className="size-8 grid place-items-center rounded-full hover:bg-secondary text-muted-foreground transition ring-focus"
        >
          <MoreVertical className="size-4" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={4}
          className="z-50 min-w-[180px] rounded-2xl bg-white shadow-elev border border-border p-1 animate-fade-in"
        >
          <Item label="View details" onSelect={onView} />
          <Item label="Edit" onSelect={onEdit} />
          <DropdownMenu.Separator className="h-px bg-border my-1" />
          <div className="px-3 py-1 text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Move to
          </div>
          {STATUSES.filter((s) => s !== task.status).map((s) => (
            <Item key={s} label={STATUS_LABEL[s]} onSelect={() => onStatusChange(s)} />
          ))}
          <DropdownMenu.Separator className="h-px bg-border my-1" />
          <Item label="Delete" danger onSelect={onDelete} />
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function Item({
  label,
  danger,
  onSelect,
}: {
  label: string;
  danger?: boolean;
  onSelect: () => void;
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex items-center gap-2 px-3 py-2 text-sm rounded-xl cursor-pointer outline-none",
        danger
          ? "hover:bg-danger/10 text-danger"
          : "hover:bg-secondary"
      )}
    >
      {label}
    </DropdownMenu.Item>
  );
}

/* -------------------------------------------------------------------------- */
/* Header controls                                                            */
/* -------------------------------------------------------------------------- */

function HeaderSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="w-52">
      <Input
        icon={<Search className="size-3.5" />}
        iconPosition="right"
        iconBg
        placeholder="Search…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white"
      />
    </div>
  );
}

function StatusDropdown({
  value,
  onChange,
}: {
  value: TaskStatus | undefined;
  onChange: (s: TaskStatus | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = value ? STATUS_LABEL[value] : "All Status";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="secondary" className="h-10 rounded-full px-3 gap-2">
          {label}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[180px] rounded-2xl bg-white shadow-elev border border-border p-1 animate-fade-in"
        >
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className={cn(
              "w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-secondary transition",
              value === undefined && "font-semibold"
            )}
          >
            All Status
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-secondary transition",
                value === s && "font-semibold"
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function FilterPopover({
  activeCount,
  renderBody,
}: {
  activeCount: number;
  renderBody: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="secondary" className="h-10 rounded-full px-4 relative">
          <Filter className="size-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 inline-grid place-items-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[min(92vw,420px)] rounded-2xl bg-white shadow-elev border border-border p-4 animate-fade-in"
        >
          {renderBody(() => setOpen(false))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function FilterPopoverBody({
  priority,
  setPriority,
  category,
  setCategory,
  onClear,
}: {
  priority: TaskPriority | undefined;
  setPriority: (p: TaskPriority | undefined) => void;
  category: TaskCategory | undefined;
  setCategory: (c: TaskCategory | undefined) => void;
  onClear: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Filters</h3>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      </div>

      <FilterGroup label="Priority">
        <FilterChip
          label="Any"
          active={priority === undefined}
          onClick={() => setPriority(undefined)}
        />
        {PRIORITIES.map((p) => (
          <FilterChip
            key={p}
            label={PRIORITY_LABEL[p]}
            active={priority === p}
            onClick={() => setPriority(priority === p ? undefined : p)}
          />
        ))}
      </FilterGroup>

      <FilterGroup label="Category">
        <FilterChip
          label="Any"
          active={category === undefined}
          onClick={() => setCategory(undefined)}
        />
        {CATEGORIES.map((c) => (
          <FilterChip
            key={c}
            label={CATEGORY_LABEL[c]}
            active={category === c}
            onClick={() => setCategory(category === c ? undefined : c)}
          />
        ))}
      </FilterGroup>
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* States                                                                     */
/* -------------------------------------------------------------------------- */

function EmptyState({
  canCreate,
  onCreate,
}: {
  canCreate: boolean;
  onCreate: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-subtle p-12 text-center">
      <div className="text-sm font-semibold">No tasks here yet</div>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
        Assign a task to a teammate or yourself — it'll appear in the relevant
        scope tab.
      </p>
      {canCreate && (
        <Button className="mt-4" onClick={onCreate}>
          <Plus className="size-3.5" /> Assign your first task
        </Button>
      )}
    </div>
  );
}
