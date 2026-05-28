/**
 * Patient-portal Topbar bell — popover preview of the synthesized
 * notifications feed (`/patient-portal/me/notifications`).
 *
 * The feed is recomputed from messages / appointments / documents /
 * forms on each request — it has no per-row `is_read` column. We
 * track a single `lastReadAt` timestamp in localStorage so the badge
 * and the visual "unread" state still feel correct. "Mark all as
 * read" just bumps that timestamp.
 */
import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  CheckCheck,
  ClipboardList,
  FileText,
  MessageSquare,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import { useNotifications } from "../hooks/use-notifications";
import type {
  NotificationKind,
  PatientNotification,
} from "../api/notifications-api";

const LAST_READ_KEY = "modern-ehr.patient.notifications.lastReadAt";

const KIND_ICON: Record<NotificationKind, React.ReactNode> = {
  message: <MessageSquare className="size-4" />,
  appointment: <CalendarClock className="size-4" />,
  document: <FileText className="size-4" />,
  form: <ClipboardList className="size-4" />,
};

/** Pastel pair for each notification kind — colored tile background +
 *  matching deeper foreground for the icon. */
const KIND_STYLE: Record<NotificationKind, string> = {
  message:
    "bg-gradient-to-br from-primary/15 to-primary/5 text-primary ring-1 ring-primary/20",
  appointment:
    "bg-gradient-to-br from-info/15 to-info/5 text-info ring-1 ring-info/20",
  document:
    "bg-gradient-to-br from-success/15 to-success/5 text-success ring-1 ring-success/20",
  form:
    "bg-gradient-to-br from-warning/15 to-warning/5 text-warning ring-1 ring-warning/20",
};

function readLastRead(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(LAST_READ_KEY);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function NotificationsBell() {
  const navigate = useNavigate();
  const { data, isLoading } = useNotifications();
  // Watermark — items with timestamp > watermark are "unread". Kept
  // in state so "Mark all as read" re-renders without a full reload.
  const [lastReadAt, setLastReadAt] = useState<number>(() => readLastRead());

  useEffect(() => {
    // Sync across tabs — another tab dismissing should clear our
    // badge too. Storage events only fire on OTHER tabs in spec, but
    // most browsers fire reliably.
    const handler = (e: StorageEvent) => {
      if (e.key === LAST_READ_KEY) setLastReadAt(readLastRead());
    };
    window.addEventListener("storage", handler);
    return () => window.removeEventListener("storage", handler);
  }, []);

  const items = data?.items ?? [];
  const isUnread = (n: PatientNotification) =>
    new Date(n.timestamp).getTime() > lastReadAt;
  const unreadCount = items.filter(isUnread).length;
  const badge = Math.min(unreadCount, 99);

  const markAllRead = () => {
    const now = Date.now();
    if (typeof window !== "undefined") {
      window.localStorage.setItem(LAST_READ_KEY, String(now));
    }
    setLastReadAt(now);
  };

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative size-10 rounded-full bg-[#F1F4F9] hover:bg-[#E6EBF2] text-slate-700"
          aria-label={`Notifications${badge ? `, ${badge} unread` : ""}`}
        >
          <Bell className="size-[18px]" />
          {badge > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-white tabular-nums">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          sideOffset={10}
          align="end"
          className={cn(
            "z-50 w-[360px] rounded-3xl bg-white animate-fade-in",
            // 3D feel: layered shadow + subtle ring + bottom soft glow.
            "ring-1 ring-slate-200/80 shadow-[0_24px_60px_-12px_rgba(15,23,42,0.18),0_8px_20px_-6px_rgba(15,23,42,0.10)]",
            "overflow-hidden",
          )}
        >
          {/* Header — slight gradient gives the card a "lit from above"
              feel without being noisy. */}
          <div className="px-4 py-3 flex items-center justify-between gap-3 bg-gradient-to-b from-white to-slate-50 border-b border-slate-200/70">
            <div className="min-w-0">
              <h3 className="font-semibold text-sm tracking-tight">
                Notifications
              </h3>
              <p className="text-[11px] text-muted-foreground">
                {unreadCount > 0
                  ? `${unreadCount} unread`
                  : items.length > 0
                    ? "You're up to date"
                    : "No recent activity"}
              </p>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={unreadCount === 0}
              className={cn(
                "text-[11px] font-semibold inline-flex items-center gap-1 px-2.5 h-7 rounded-full transition",
                unreadCount > 0
                  ? "text-primary bg-primary/10 hover:bg-primary/15 ring-1 ring-primary/15"
                  : "text-muted-foreground bg-slate-100 ring-1 ring-slate-200 cursor-not-allowed",
              )}
            >
              <CheckCheck className="size-3" />
              Mark all as read
            </button>
          </div>

          <div className="max-h-[420px] overflow-y-auto p-2 space-y-1.5 bg-slate-50/40">
            {isLoading && <SkeletonRows />}

            {!isLoading && items.length === 0 && (
              <div className="px-4 py-10 text-center text-xs text-muted-foreground">
                You&apos;re all caught up.
              </div>
            )}

            {!isLoading &&
              items.slice(0, 8).map((n) => (
                <Row key={n.id} n={n} unread={isUnread(n)} />
              ))}
          </div>

          <div className="px-4 py-2.5 border-t border-slate-200/70 bg-white">
            <button
              type="button"
              onClick={() => navigate("/notifications")}
              className="w-full text-xs font-semibold text-primary hover:underline text-center"
            >
              View all notifications
            </button>
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Row({
  n,
  unread,
}: {
  n: PatientNotification;
  unread: boolean;
}) {
  const inner = (
    <div
      className={cn(
        // Elevated card with hover lift for tactile feel.
        "relative rounded-2xl px-3 py-3 flex items-start gap-3 transition-all duration-200",
        "bg-white ring-1 hover:-translate-y-px hover:shadow-md",
        unread
          ? "ring-primary/15 shadow-[0_4px_14px_-6px_rgba(79,140,255,0.25)]"
          : "ring-slate-200/70 shadow-sm",
      )}
    >
      {/* Left unread bar */}
      {unread && (
        <span className="absolute left-0 top-2 bottom-2 w-1 rounded-r-full bg-primary" />
      )}
      <div
        className={cn(
          "size-10 rounded-xl grid place-items-center shrink-0",
          KIND_STYLE[n.kind],
        )}
      >
        {KIND_ICON[n.kind]}
      </div>
      <div className="flex-1 min-w-0">
        {/* Title + time on the SAME row — time on the front (right) */}
        <div className="flex items-start justify-between gap-2">
          <div
            className={cn(
              "text-sm truncate leading-tight",
              unread ? "font-semibold text-foreground" : "font-medium text-foreground/80",
            )}
          >
            {n.title}
          </div>
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0 mt-0.5">
            {relativeTime(n.timestamp)}
          </span>
        </div>
        {n.body && (
          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5">
            {n.body}
          </p>
        )}
      </div>
    </div>
  );
  return n.href ? (
    <Link to={n.href} className="block">
      {inner}
    </Link>
  ) : (
    <div>{inner}</div>
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
