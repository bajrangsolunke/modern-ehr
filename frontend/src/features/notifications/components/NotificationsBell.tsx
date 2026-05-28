/**
 * Topbar bell — live unread badge driven by `useUnreadNotificationCount`
 * (WS-invalidated). Popover lists the most recent notifications;
 * clicking one marks it read and deep-links via `link`.
 *
 * On first mount, asks for OS-level notification permission so
 * high/critical-urgency events can wake an OS toast when the tab is
 * hidden (the actual `new Notification(...)` call lives in
 * `useMessagesSocket.handleNotification`).
 */
import { useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, CheckCheck } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useNotifications,
  useUnreadNotificationCount,
  useMarkNotificationRead,
  useMarkAllNotificationsRead,
} from "../hooks/use-notifications";
import type {
  AppNotification,
  NotificationKind,
  NotificationUrgency,
} from "../api/notifications-api";

const KIND_LABEL: Partial<Record<NotificationKind, string>> = {
  appointment_booked: "Appointment",
  appointment_today: "Appointment",
  appointment_cancelled: "Appointment",
  appointment_rescheduled: "Appointment",
  appointment_reminder_24h: "Appointment",
  appointment_reminder_1h: "Appointment",
  appointment_no_show: "Appointment",
  patient_checked_in: "Check-in",
  patient_assigned: "Patient",
  task_assigned: "Task",
  task_due_soon: "Task",
  task_overdue: "Task",
  form_assigned: "Form",
  form_due_soon: "Form",
  form_overdue: "Form",
  form_submitted: "Form",
  form_approved: "Form",
  form_denied: "Form",
  new_message: "Message",
  lab_result_returned: "Lab",
  lab_result_available: "Lab",
  critical_patient_alert: "Alert",
  unsigned_encounter: "Chart",
  patient_vitals_submitted: "Vitals",
  patient_document_uploaded: "Document",
  referral_status_update: "Referral",
  prescription_ready: "Rx",
  visit_summary_ready: "Summary",
  schedule_changed: "Schedule",
  account_security_event: "Security",
};

/** Pastel tile pair per urgency — drives the colored avatar tile on
 *  the left side of each row. */
const URGENCY_TILE: Record<NotificationUrgency, string> = {
  critical:
    "bg-gradient-to-br from-danger/20 to-danger/5 text-danger ring-1 ring-danger/25",
  high:
    "bg-gradient-to-br from-warning/20 to-warning/5 text-warning ring-1 ring-warning/25",
  normal:
    "bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20",
  low: "bg-gradient-to-br from-slate-200 to-slate-50 text-slate-500 ring-1 ring-slate-200",
};

export function NotificationsBell() {
  const navigate = useNavigate();
  const unread = useUnreadNotificationCount();
  const { data: items = [], isLoading } = useNotifications();
  const markRead = useMarkNotificationRead();
  const markAll = useMarkAllNotificationsRead();

  // Ask once per session — browsers no-op on subsequent calls.
  useEffect(() => {
    if (
      typeof Notification !== "undefined" &&
      Notification.permission === "default"
    ) {
      Notification.requestPermission().catch(() => {});
    }
  }, []);

  const visible = useMemo(() => items.slice(0, 12), [items]);

  const onItemClick = (n: AppNotification) => {
    if (!n.isRead) markRead.mutate(n.id);
    if (n.link) navigate(n.link);
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-10 rounded-full bg-[#F1F4F9] hover:bg-[#E6EBF2] text-slate-700"
          aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}
        >
          <Bell className="size-[18px]" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-white tabular-nums">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={10}
          align="end"
          className={cn(
            "z-50 w-[380px] rounded-3xl bg-white animate-fade-in overflow-hidden",
            // Layered shadow + ring for the "3D lifted card" feel.
            "ring-1 ring-slate-200/80 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.20),0_8px_20px_-6px_rgba(15,23,42,0.10)]",
          )}
        >
          <div className="px-4 py-3 flex items-center justify-between gap-3 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200/70">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm tracking-tight">
                Notifications
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {unread > 0
                  ? `${unread} unread`
                  : items.length > 0
                    ? "You're up to date"
                    : "No recent activity"}
              </p>
            </div>
            <button
              type="button"
              onClick={() => markAll.mutate()}
              disabled={unread === 0 || markAll.isPending}
              className={cn(
                "text-[11px] font-semibold inline-flex items-center gap-1 px-2.5 h-7 rounded-full transition",
                unread > 0
                  ? "text-primary bg-primary/10 hover:bg-primary/15 ring-1 ring-primary/15"
                  : "text-muted-foreground bg-slate-100 ring-1 ring-slate-200 cursor-not-allowed",
              )}
            >
              <CheckCheck className="size-3" />
              Mark all as read
            </button>
          </div>

          <div className="max-h-[440px] overflow-y-auto p-2 space-y-1.5 bg-slate-50/40">
            {isLoading && <SkeletonRows />}
            {!isLoading && visible.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                You&apos;re all caught up.
              </div>
            )}
            {visible.map((n) => (
              <NotifRow key={n.id} n={n} onClick={() => onItemClick(n)} />
            ))}
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function NotifRow({
  n,
  onClick,
}: {
  n: AppNotification;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-2xl px-3 py-3 flex items-start gap-3 transition-all duration-200",
        "bg-white ring-1 hover:-translate-y-px hover:shadow-md relative",
        !n.isRead
          ? "ring-primary/15 shadow-[0_4px_14px_-6px_rgba(79,140,255,0.25)]"
          : "ring-slate-200/70 shadow-sm",
      )}
    >
      {!n.isRead && (
        <span
          className={cn(
            "absolute left-0 top-2 bottom-2 w-1 rounded-r-full",
            n.urgency === "critical"
              ? "bg-danger"
              : n.urgency === "high"
                ? "bg-warning"
                : "bg-primary",
          )}
        />
      )}
      <div
        className={cn(
          "size-10 rounded-xl grid place-items-center shrink-0 [&_svg]:size-4",
          URGENCY_TILE[n.urgency],
        )}
        aria-hidden="true"
      >
        <Bell />
      </div>
      <div className="flex-1 min-w-0">
        {/* Title (+ kind chip) and time on the SAME row — time on the front. */}
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "text-sm truncate leading-tight",
              !n.isRead
                ? "font-semibold text-foreground"
                : "font-medium text-foreground/80",
            )}
          >
            {n.title}
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
            {relativeShort(n.createdAt)}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-0.5">
          <span className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">
            {KIND_LABEL[n.kind] ?? "Notification"}
          </span>
          {n.body && (
            <span className="text-[10px] text-muted-foreground">·</span>
          )}
          {n.body && (
            <p className="text-[11px] text-muted-foreground line-clamp-1 min-w-0 flex-1">
              {n.body}
            </p>
          )}
        </div>
      </div>
    </button>
  );
}

function SkeletonRows() {
  return (
    <>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl px-3 py-3 flex items-start gap-3 bg-white ring-1 ring-slate-200/70 shadow-sm"
        >
          <div className="size-10 rounded-xl bg-muted-foreground/10 shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-4 w-3/4" />
          </div>
        </div>
      ))}
    </>
  );
}

function relativeShort(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (Number.isNaN(diffMs) || diffMs < 0) return "now";
  const min = Math.floor(diffMs / 60_000);
  if (min < 1) return "now";
  if (min < 60) return `${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d`;
  const week = Math.floor(day / 7);
  if (week < 5) return `${week}w`;
  return new Date(iso).toLocaleDateString();
}
