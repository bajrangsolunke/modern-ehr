/**
 * Read-focused task details modal — US-TASK-3.
 *
 * Opens when a user clicks a row in the tasks table. Shows the full
 * task at a glance with status quick-actions, Edit, and Delete in the
 * footer. Status changes are optimistic via useUpdateTask so the
 * badge flips without re-opening.
 */
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Calendar,
  CalendarClock,
  CheckCircle2,
  Clock,
  Pencil,
  PlayCircle,
  Tag,
  Trash2,
  User as UserIcon,
  XCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { useUpdateTask } from "../hooks/use-tasks";
import {
  CATEGORY_LABEL,
  PRIORITY_LABEL,
  PRIORITY_TONE,
  STATUS_LABEL,
  STATUS_TONE,
  taskIdLabel,
} from "../utils";
import type { Task, TaskStatus } from "../api/tasks-api";
import { cn, formatDate, formatTime } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: Task | null;
  /** Called when the user picks "Edit" — parent closes the details
   *  modal and opens TaskDrawer in edit mode. */
  onEdit: (t: Task) => void;
  /** Called when the user picks "Delete" — parent shows the confirm
   *  dialog. */
  onDelete?: (t: Task) => void;
  /** Whether the viewer can modify (write actions hide when false). */
  canModify?: boolean;
}

export function TaskDetailsModal({
  open,
  onOpenChange,
  task,
  onEdit,
  onDelete,
  canModify = true,
}: Props) {
  const update = useUpdateTask();

  if (!task) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title="Task" size="md">
        <div />
      </Modal>
    );
  }

  const t = task;

  const setStatus = (next: TaskStatus) => {
    update.mutate({ id: t.id, input: { status: next } });
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={t.title}
      description={`${taskIdLabel(t.id)} · ${CATEGORY_LABEL[t.category]}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <StatusActions
            status={t.status}
            onSet={setStatus}
            disabled={update.isPending || !canModify}
          />
          <div className="flex items-center gap-2">
            {canModify && onDelete && (
              <Button
                variant="secondary"
                className="h-9 text-danger hover:text-danger"
                onClick={() => {
                  onOpenChange(false);
                  onDelete(t);
                }}
              >
                <Trash2 className="size-3.5" /> Delete
              </Button>
            )}
            {canModify && (
              <Button
                className="h-9"
                onClick={() => {
                  onOpenChange(false);
                  onEdit(t);
                }}
              >
                <Pencil className="size-3.5" /> Edit
              </Button>
            )}
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        {/* Status + priority chips */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={cn("border-transparent", STATUS_TONE[t.status])}>
            {STATUS_LABEL[t.status]}
          </Badge>
          <Badge className={cn("border-transparent", PRIORITY_TONE[t.priority])}>
            {PRIORITY_LABEL[t.priority]} priority
          </Badge>
        </div>

        {/* Description */}
        {t.description && (
          <section>
            <SectionLabel>Description</SectionLabel>
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">
              {t.description}
            </p>
          </section>
        )}

        {/* Meta grid */}
        <section>
          <SectionLabel>Details</SectionLabel>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <MetaRow
              icon={<UserIcon className="size-3.5" />}
              label="Assigned to"
              value={
                t.assignedToName ? (
                  <span className="flex items-center gap-2">
                    <UserAvatar name={t.assignedToName} size="sm" />
                    <span className="font-medium">{t.assignedToName}</span>
                  </span>
                ) : (
                  <span className="text-muted-foreground italic">
                    Unassigned
                  </span>
                )
              }
            />
            <MetaRow
              icon={<UserIcon className="size-3.5" />}
              label="Created by"
              value={t.createdByName ?? <span className="text-muted-foreground italic">System</span>}
            />
            <MetaRow
              icon={<Tag className="size-3.5" />}
              label="Category"
              value={CATEGORY_LABEL[t.category]}
            />
            <MetaRow
              icon={<Calendar className="size-3.5" />}
              label="Due date"
              value={
                t.dueDate ? (
                  formatDate(t.dueDate)
                ) : (
                  <span className="text-muted-foreground">No due date</span>
                )
              }
            />
            <MetaRow
              icon={<CalendarClock className="size-3.5" />}
              label="Created"
              value={`${formatDate(t.createdAt)} · ${formatTime(t.createdAt)}`}
            />
            {t.completedAt && (
              <MetaRow
                icon={<Clock className="size-3.5" />}
                label="Completed"
                value={`${formatDate(t.completedAt)} · ${formatTime(t.completedAt)}`}
              />
            )}
          </div>
        </section>

        {/* Linked patient deep-link */}
        {t.patientId && (
          <Link
            to={`/patients/${t.patientId}`}
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-between gap-3 rounded-2xl bg-surface-subtle px-3 py-2.5 hover:bg-surface-subtle/70 transition group"
          >
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Linked patient
              </div>
              <div className="font-semibold truncate">
                {t.patientName ?? "Patient"}
              </div>
            </div>
            <span className="text-xs text-primary font-semibold inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
              Open chart <ArrowRight className="size-3.5" />
            </span>
          </Link>
        )}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */

function StatusActions({
  status,
  onSet,
  disabled,
}: {
  status: TaskStatus;
  onSet: (next: TaskStatus) => void;
  disabled: boolean;
}) {
  // Surface the most likely next moves as one-click buttons. Edit
  // still covers the long tail.
  const actions = nextStatusActions(status);
  if (actions.length === 0) return <div />;
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {actions.map((a) => (
        <button
          key={a.value}
          type="button"
          disabled={disabled}
          onClick={() => onSet(a.value)}
          className={cn(
            "h-9 px-3 rounded-full text-xs font-semibold border transition inline-flex items-center gap-1.5 ring-focus",
            a.tone,
            "disabled:opacity-60 disabled:cursor-not-allowed"
          )}
        >
          {a.icon}
          {a.label}
        </button>
      ))}
    </div>
  );
}

function nextStatusActions(status: TaskStatus): Array<{
  value: TaskStatus;
  label: string;
  icon: React.ReactNode;
  tone: string;
}> {
  switch (status) {
    case "new":
      return [
        {
          value: "in_progress",
          label: "Start",
          icon: <PlayCircle className="size-3.5" />,
          tone: "border-warning/30 bg-warning/5 text-warning hover:bg-warning/10",
        },
        {
          value: "completed",
          label: "Complete",
          icon: <CheckCircle2 className="size-3.5" />,
          tone: "border-success/30 bg-success/5 text-success hover:bg-success/10",
        },
        {
          value: "cancelled",
          label: "Cancel",
          icon: <XCircle className="size-3.5" />,
          tone: "border-border bg-white text-muted-foreground hover:text-foreground",
        },
      ];
    case "in_progress":
      return [
        {
          value: "completed",
          label: "Complete",
          icon: <CheckCircle2 className="size-3.5" />,
          tone: "border-success/30 bg-success/5 text-success hover:bg-success/10",
        },
        {
          value: "new",
          label: "Back to new",
          icon: <PlayCircle className="size-3.5" />,
          tone: "border-border bg-white text-muted-foreground hover:text-foreground",
        },
        {
          value: "cancelled",
          label: "Cancel",
          icon: <XCircle className="size-3.5" />,
          tone: "border-border bg-white text-muted-foreground hover:text-foreground",
        },
      ];
    case "completed":
      return [
        {
          value: "in_progress",
          label: "Re-open",
          icon: <PlayCircle className="size-3.5" />,
          tone: "border-warning/30 bg-warning/5 text-warning hover:bg-warning/10",
        },
      ];
    case "cancelled":
      return [
        {
          value: "new",
          label: "Re-open",
          icon: <PlayCircle className="size-3.5" />,
          tone: "border-info/30 bg-info/5 text-info hover:bg-info/10",
        },
      ];
  }
}

/* -------------------------------------------------------------------------- */

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
      {children}
    </h4>
  );
}

function MetaRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl bg-surface-subtle px-3 py-2.5">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold inline-flex items-center gap-1.5 mb-0.5">
        {icon}
        {label}
      </div>
      <div className="text-sm">{value}</div>
    </div>
  );
}
