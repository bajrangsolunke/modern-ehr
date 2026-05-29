import { useNavigate } from "react-router-dom";
import { ArrowUpRight, MessageCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { relativeTime } from "@/lib/datetime";
import { cn } from "@/lib/utils";
import type { DashboardRecentMessage } from "@/features/dashboard/api/dashboard-api";

export function RecentMessage({ msg }: { msg: DashboardRecentMessage | null }) {
  const navigate = useNavigate();
  return (
    <Card
      className={cn(
        "p-5 rounded-3xl border-slate-200/70 bg-white flex flex-col gap-3",
        "shadow-[0_1px_2px_rgba(15,23,42,0.04),0_10px_24px_-14px_rgba(15,23,42,0.10)]"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2">
          <div className="size-8 rounded-xl bg-primary/10 text-primary grid place-items-center">
            <MessageCircle className="size-4" />
          </div>
          <h3 className="text-[13px] font-semibold tracking-tight text-slate-900">
            Latest message
          </h3>
        </div>
        {msg && (
          <span className="inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-600 px-2 py-0.5 text-[10px] font-bold">
            <span className="size-1.5 rounded-full bg-rose-500" />
            New
          </span>
        )}
      </div>

      {msg ? (
        <>
          <div className="flex items-center gap-3">
            <UserAvatar
              name={msg.sender_name ?? "Care team"}
              src={msg.sender_avatar_url ?? undefined}
              size="md"
            />
            <div className="min-w-0 flex-1">
              <div className="text-[13px] font-semibold text-slate-900 truncate">
                {msg.sender_name ?? "Care team"}
              </div>
              <div className="text-[11px] text-slate-500">
                {relativeTime(msg.sent_at)}
              </div>
            </div>
          </div>
          <p className="text-[12.5px] text-slate-600 leading-relaxed line-clamp-3">
            {msg.preview}
          </p>
          <Button
            size="sm"
            onClick={() => navigate("/messages")}
            className="self-start"
          >
            Open conversation
            <ArrowUpRight className="size-3.5" />
          </Button>
        </>
      ) : (
        <>
          <p className="text-[12.5px] text-slate-500">
            When your care team writes to you, it'll appear here.
          </p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => navigate("/messages")}
            className="self-start"
          >
            Go to Communication
          </Button>
        </>
      )}
    </Card>
  );
}
