import { Link } from "react-router-dom";
import {
  Bell,
  CalendarClock,
  FileText,
  Loader2,
  MessageSquare,
  ClipboardList,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Card } from "@/components/ui/card";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { humanWhen, relativeTime } from "@/lib/datetime";
import { useNotifications } from "./hooks/use-notifications";
import type { NotificationKind } from "./api/notifications-api";

const KIND_ICON: Record<NotificationKind, React.ReactNode> = {
  message: <MessageSquare className="size-4" />,
  appointment: <CalendarClock className="size-4" />,
  document: <FileText className="size-4" />,
  form: <ClipboardList className="size-4" />,
};

const KIND_COLOR: Record<NotificationKind, string> = {
  message: "bg-primary/10 text-primary",
  appointment: "bg-info/10 text-info",
  document: "bg-success/10 text-success",
  form: "bg-warning/10 text-warning",
};

export function NotificationsPage() {
  const { data, isLoading, isError, error, refetch, isFetching } = useNotifications();

  return (
    <>
      <PageHeader
        title="Notifications"
        subtitle="Updates from your appointments, messages, and care plan."
      />

      {isLoading && (
        <div className="grid place-items-center py-16">
          <Loader2 className="size-6 animate-spin text-primary" />
        </div>
      )}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load notifications"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && data && (
        <div className="max-w-3xl">
          {data.items.length === 0 ? (
            <Empty
              icon={<Bell className="size-5" />}
              title="No notifications"
              description="You're all caught up. We'll let you know when something needs your attention."
            />
          ) : (
            <Card className="divide-y divide-border">
              {data.items.map((n) => {
                const Wrapper = ({ children }: { children: React.ReactNode }) =>
                  n.href ? (
                    <Link
                      to={n.href}
                      className="flex items-start gap-3 px-5 py-4 hover:bg-secondary/50 transition-colors first:rounded-t-2xl last:rounded-b-2xl"
                    >
                      {children}
                    </Link>
                  ) : (
                    <div className="flex items-start gap-3 px-5 py-4 first:rounded-t-2xl last:rounded-b-2xl">
                      {children}
                    </div>
                  );
                return (
                  <Wrapper key={n.id}>
                    <div
                      className={`size-10 rounded-xl grid place-items-center shrink-0 ${KIND_COLOR[n.kind]}`}
                    >
                      {KIND_ICON[n.kind]}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-semibold text-foreground">{n.title}</div>
                      {n.body && (
                        <p className="text-sm text-muted-foreground mt-0.5 line-clamp-2">
                          {n.body}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground mt-1 tabular-nums">
                        {n.kind === "appointment"
                          ? humanWhen(n.timestamp)
                          : relativeTime(n.timestamp)}
                      </div>
                    </div>
                  </Wrapper>
                );
              })}
            </Card>
          )}
        </div>
      )}
    </>
  );
}
