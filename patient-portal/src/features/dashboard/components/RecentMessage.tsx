import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { relativeTime } from "@/lib/datetime";
import type { DashboardRecentMessage } from "@/features/dashboard/api/dashboard-api";

export function RecentMessage({ msg }: { msg: DashboardRecentMessage | null }) {
  const navigate = useNavigate();
  return (
    <Card className="h-full p-6 flex flex-col">
      <div className="flex items-start gap-4 flex-1">
        <div className="size-12 rounded-2xl bg-primary/10 text-primary grid place-items-center shrink-0">
          <MessageCircle className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold mb-1">
            Latest message
          </div>
          {msg ? (
            <>
              {msg.sender_name && (
                <div className="text-sm font-semibold text-foreground">
                  {msg.sender_name}{" "}
                  <span className="text-muted-foreground font-normal">
                    · {relativeTime(msg.sent_at)}
                  </span>
                </div>
              )}
              <p className="text-sm text-muted-foreground mt-1 line-clamp-3">
                {msg.preview}
              </p>
            </>
          ) : (
            <>
              <div className="text-base font-semibold">No messages yet</div>
              <p className="text-sm text-muted-foreground mt-1">
                When your care team writes to you, it'll appear here.
              </p>
            </>
          )}
        </div>
      </div>
      <div className="pt-4 mt-auto">
        <Button
          size="sm"
          variant={msg ? "default" : "secondary"}
          onClick={() => navigate("/messages")}
        >
          {msg ? "Open message" : "Go to Communication"}
        </Button>
      </div>
    </Card>
  );
}
