/**
 * Compact right-rail card surfacing the viewer's unread message
 * activity — total count + up to three most-recent unread previews.
 * Clicking a row deep-links into the conversation in /messages.
 */
import { useNavigate } from "react-router-dom";
import { ArrowRight, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { UserAvatar } from "@/components/ui/avatar";
import { useDashboard } from "../hooks/use-dashboard";
import type { DashboardMessage } from "../api/dashboard-api";

/** Quick "5m / 2h / 3d" relative formatter — sized for the badge in
 *  this card; no need to pull in date-fns for one site. */
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

const ROW_BG = "#F5F7FB";

export function MessagesNotificationCard() {
  const { data, isLoading, isError } = useDashboard();
  const navigate = useNavigate();

  const total = data?.unreadMessagesCount ?? 0;
  const rows = data?.recentUnreadMessages ?? [];

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="size-8 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <MessageSquare className="size-4" />
          </span>
          Messages
          {total > 0 && (
            <span className="ml-1 inline-grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-danger text-white text-[10px] font-bold tabular-nums">
              {total > 99 ? "99+" : total}
            </span>
          )}
        </CardTitle>
        <button
          type="button"
          onClick={() => navigate("/messages")}
          className="text-sm font-medium text-primary hover:underline inline-flex items-center gap-1"
        >
          Open <ArrowRight className="size-3.5" />
        </button>
      </CardHeader>
      <CardContent className="space-y-2 pb-5">
        {isLoading && <SkeletonRows />}

        {isError && !isLoading && (
          <div className="text-sm text-muted-foreground italic py-6 text-center">
            Couldn&apos;t load messages.
          </div>
        )}

        {!isLoading && !isError && rows.length === 0 && (
          <div className="text-sm text-muted-foreground italic py-6 text-center">
            No new messages.
          </div>
        )}

        {!isLoading &&
          rows.map((row, i) => (
            <MessageRow
              key={row.conversationId}
              row={row}
              index={i}
              onOpen={() => navigate(`/messages?conversation=${row.conversationId}`)}
            />
          ))}
      </CardContent>
    </Card>
  );
}

function MessageRow({
  row,
  index,
  onOpen,
}: {
  row: DashboardMessage;
  index: number;
  onOpen: () => void;
}) {
  return (
    <motion.button
      type="button"
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      onClick={onOpen}
      className="w-full flex items-start gap-3 rounded-2xl p-3 text-left ring-focus hover:[background:#EEF2F8] transition"
      style={{ background: ROW_BG }}
    >
      <UserAvatar name={row.senderName} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2">
          <span className="font-semibold text-[14px] truncate">
            {row.senderName}
          </span>
          <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
            {relativeShort(row.sentAt)}
          </span>
        </div>
        <p className="text-[12px] text-muted-foreground line-clamp-2 mt-0.5">
          {row.preview || <span className="italic">(no preview)</span>}
        </p>
      </div>
      {row.unreadCount > 1 && (
        <span className="inline-grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold tabular-nums shrink-0">
          {row.unreadCount}
        </span>
      )}
    </motion.button>
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
          <div className="skeleton size-9 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <div className="skeleton h-3.5 w-1/3" />
            <div className="skeleton h-3 w-3/4" />
          </div>
        </div>
      ))}
    </>
  );
}
