import { useEffect, useRef } from "react";
import { AlertCircle } from "lucide-react";
import type { Message } from "../types";
import { cn, formatTime } from "@/lib/utils";

interface Props {
  messages: Message[];
  participantName: string;
}

export function MessageThread({ messages, participantName }: Props) {
  const endRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  return (
    <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4 space-y-3 bg-[#FAFBFE]">
      {messages.length === 0 && (
        <div className="text-center text-xs text-muted-foreground py-12">
          No messages yet. Say hi.
        </div>
      )}
      {messages.map((m) => (
        <Bubble key={m.id} message={m} participantName={participantName} />
      ))}
      <div ref={endRef} />
    </div>
  );
}

function Bubble({
  message,
  participantName,
}: {
  message: Message;
  participantName: string;
}) {
  const outgoing = message.direction === "outgoing";
  return (
    <div className={cn("flex flex-col gap-1", outgoing ? "items-end" : "items-start")}>
      {!outgoing && (
        <span className="text-[11px] text-muted-foreground px-1">
          {participantName}
        </span>
      )}
      <div
        className={cn(
          "max-w-[min(560px,75%)] rounded-2xl px-3.5 py-2.5 shadow-soft text-sm leading-relaxed",
          outgoing
            ? "bg-primary text-primary-foreground rounded-tr-md"
            : "bg-white border border-border rounded-tl-md"
        )}
      >
        {message.urgent && (
          <div
            className={cn(
              "mb-1 inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider",
              outgoing ? "text-amber-100" : "text-danger"
            )}
          >
            <AlertCircle className="size-3" /> Urgent
          </div>
        )}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <div
          className={cn(
            "text-[10px] mt-1 tabular-nums",
            outgoing ? "text-white/70" : "text-muted-foreground"
          )}
        >
          {formatTime(message.sentAt)}
        </div>
      </div>
    </div>
  );
}
