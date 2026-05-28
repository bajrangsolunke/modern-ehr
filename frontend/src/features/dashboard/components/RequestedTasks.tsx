/**
 * Right-rail card listing the signed-in user's open requested tasks,
 * ordered most-urgent-first by the backend. Replaces the legacy
 * "Appoint request" mock card.
 */
import { useNavigate } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  ClipboardList,
  Loader2,
  MessageSquare,
} from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { UserAvatar } from "@/components/ui/avatar";
import { useDashboard } from "../hooks/use-dashboard";
import { useUpdateTask } from "@/features/tasks/hooks/use-tasks";
import type {
  DashboardLatestMessage,
  DashboardTask,
  DashboardTaskPriority,
} from "../api/dashboard-api";
import { cn, formatDate } from "@/lib/utils";

const ROW_BG = "#F5F7FB";

const PRIORITY_TONE: Record<DashboardTaskPriority, string> = {
  high: "bg-danger/10 text-danger",
  medium: "bg-warning/10 text-warning",
  low: "bg-muted text-muted-foreground",
};

const PRIORITY_LABEL: Record<DashboardTaskPriority, string> = {
  high: "High",
  medium: "Medium",
  low: "Low",
};

export function RequestedTasks() {
  const { data, isLoading, isError } = useDashboard();
  const navigate = useNavigate();
  const update = useUpdateTask();

  const tasks = data?.requestedTasks ?? [];
  const total = data?.requestedTasksTotal ?? 0;
  const latestMessage = data?.latestMessage ?? null;
  const unreadMessages = data?.unreadMessagesCount ?? 0;

  const markComplete = (taskId: string) => {
    update.mutate({ id: taskId, input: { status: "completed" } });
  };

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="size-8 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <ClipboardList className="size-4" />
          </span>
          Requested tasks
          {total > 0 && (
            <span className="ml-1 inline-grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </CardTitle>
        <button
          type="button"
          onClick={() => navigate("/tasks?audience=users")}
          className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          View more <ArrowRight className="size-3.5" />
        </button>
      </CardHeader>
      <CardContent className="space-y-2.5 pb-5">
        {isLoading && <SkeletonRows />}

        {isError && !isLoading && (
          <div className="text-sm text-muted-foreground italic py-6 text-center">
            Couldn&apos;t load tasks. We&apos;ll retry shortly.
          </div>
        )}

        {!isLoading && !isError && tasks.length === 0 && (
          <div className="text-sm text-muted-foreground italic py-6 text-center">
            You&apos;re all caught up — no open tasks.
          </div>
        )}

        {!isLoading &&
          tasks.map((t, i) => (
            <TaskRow
              key={t.id}
              task={t}
              index={i}
              busy={update.isPending}
              onOpen={() => navigate("/tasks?audience=users")}
              onComplete={() => markComplete(t.id)}
            />
          ))}

        {/* Compact "Latest message" strip — replaces the old standalone
            messages card. Shows even when there's nothing unread, so
            the area is never empty as long as the viewer has any
            conversations at all. */}
        <LatestMessageStrip
          message={latestMessage}
          unread={unreadMessages}
          onOpen={() =>
            latestMessage
              ? navigate(`/messages?conversation=${latestMessage.conversationId}`)
              : navigate("/messages")
          }
        />
      </CardContent>
    </Card>
  );
}

function LatestMessageStrip({
  message,
  unread,
  onOpen,
}: {
  message: DashboardLatestMessage | null;
  unread: number;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full flex items-center gap-3 rounded-2xl border-t border-border/60 mt-3 pt-3 px-1 text-left ring-focus group"
    >
      {message ? (
        <UserAvatar name={message.senderName ?? "Patient"} size="sm" />
      ) : (
        <span className="size-9 rounded-full bg-primary/10 grid place-items-center text-primary shrink-0">
          <MessageSquare className="size-4" />
        </span>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
            Latest message
          </span>
          {unread > 0 && (
            <span className="inline-grid place-items-center min-w-4 h-4 px-1 rounded-full bg-danger text-white text-[9px] font-bold tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </div>
        {message ? (
          <>
            <div className="text-[13px] font-semibold truncate">
              {message.senderName ?? "Unknown sender"}
            </div>
            <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">
              {message.preview || (
                <span className="italic">(no preview)</span>
              )}
            </p>
          </>
        ) : (
          <p className="text-[12px] text-muted-foreground mt-0.5">
            No messages yet. Open Communication to start one.
          </p>
        )}
      </div>
      <ArrowRight className="size-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition" />
    </button>
  );
}

function TaskRow({
  task,
  index,
  busy,
  onOpen,
  onComplete,
}: {
  task: DashboardTask;
  index: number;
  busy: boolean;
  onOpen: () => void;
  onComplete: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex items-start gap-3 rounded-2xl p-3 hover:[background:#EEF2F8] transition"
      style={{ background: ROW_BG }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex-1 min-w-0 text-left ring-focus"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Badge
            className={cn(
              "border-transparent text-[10px] uppercase tracking-wide px-2 py-0",
              PRIORITY_TONE[task.priority],
            )}
          >
            {PRIORITY_LABEL[task.priority]}
          </Badge>
          {task.dueDate && (
            <span className="text-[11px] text-foreground/70 tabular-nums">
              Due {formatDate(task.dueDate)}
            </span>
          )}
        </div>
        <div className="font-semibold text-[14px] leading-tight mt-1.5 truncate hover:text-primary transition">
          {task.title}
        </div>
        {task.patientName && (
          <div className="text-[11px] text-muted-foreground truncate mt-0.5">
            Related to {task.patientName}
          </div>
        )}
      </button>
      <button
        type="button"
        onClick={onComplete}
        disabled={busy}
        aria-label="Mark complete"
        className="size-8 rounded-full bg-white text-success hover:bg-emerald-50 shadow-soft grid place-items-center shrink-0 disabled:opacity-50"
      >
        {busy ? (
          <Loader2 className="size-3.5 animate-spin" />
        ) : (
          <CheckCircle2 className="size-3.5" />
        )}
      </button>
    </motion.div>
  );
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="flex items-start gap-3 rounded-2xl p-3"
          style={{ background: ROW_BG }}
        >
          <div className="flex-1 space-y-2">
            <div className="skeleton h-3.5 w-24" />
            <div className="skeleton h-4 w-3/4" />
            <div className="skeleton h-3 w-1/2" />
          </div>
          <div className="skeleton size-8 rounded-full" />
        </div>
      ))}
    </>
  );
}
