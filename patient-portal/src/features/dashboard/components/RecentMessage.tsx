import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { toast } from "@/lib/toast";
import type { DashboardRecentMessage } from "@/features/dashboard/api/dashboard-api";

function relativeTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.round(diff / 3600)}h ago`;
  return `${Math.round(diff / 86400)}d ago`;
}

export function RecentMessage({ msg }: { msg: DashboardRecentMessage }) {
  return (
    <Card>
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-full bg-primary-soft text-primary grid place-items-center shrink-0">
          <MessageCircle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-xs uppercase tracking-wider text-muted font-semibold mb-1">
            Latest message
          </div>
          {msg.sender_name && (
            <div className="text-sm font-semibold text-foreground">
              {msg.sender_name}{" "}
              <span className="text-muted font-normal">
                · {relativeTime(msg.sent_at)}
              </span>
            </div>
          )}
          <p className="text-sm text-muted mt-1 line-clamp-2">{msg.preview}</p>
          <div className="mt-4">
            <Button
              size="md"
              onClick={() => toast.info("Messages — coming soon")}
            >
              Open message
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
