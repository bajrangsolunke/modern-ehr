import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/datetime";
import { toast } from "@/lib/toast";
import type { DashboardRecentMessage } from "@/features/dashboard/api/dashboard-api";

export function RecentMessage({ msg }: { msg: DashboardRecentMessage }) {
  return (
    <Card className="p-6">
      <div className="flex items-start gap-4">
        <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <MessageCircle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Latest message
          </div>
          {msg.sender_name && (
            <div className="text-sm font-semibold text-foreground">
              {msg.sender_name}{" "}
              <span className="text-muted-foreground font-normal">
                · {relativeTime(msg.sent_at)}
              </span>
            </div>
          )}
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{msg.preview}</p>
          <div className="mt-4">
            <Button
              size="sm"
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
