import { useEffect, useRef } from "react";
import { UserAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Message } from "@/features/messages/api/messages-api";

interface Props {
  messages: Message[];
}

export function MessageThread({ messages }: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="text-center text-sm text-muted-foreground py-12">
        No messages yet. Start the conversation below.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((m) => {
        const fromPatient = m.sender_kind === "patient";
        return (
          <div
            key={m.id}
            className={cn(
              "flex items-end gap-2",
              fromPatient && "flex-row-reverse"
            )}
          >
            {!fromPatient && (
              <UserAvatar
                name={m.sender_name ?? "Care team"}
                size="sm"
                className="self-end"
              />
            )}
            <div
              className={cn(
                "max-w-[78%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed shadow-soft",
                fromPatient
                  ? "bg-primary-gradient text-white rounded-br-md"
                  : "bg-white border border-border text-foreground rounded-bl-md"
              )}
            >
              {!fromPatient && m.sender_name && (
                <div className="text-[11px] font-semibold uppercase tracking-wider opacity-70 mb-0.5">
                  {m.sender_name}
                </div>
              )}
              <div className="whitespace-pre-wrap break-words">{m.body}</div>
              <div
                className={cn(
                  "text-[10px] mt-1 tabular-nums",
                  fromPatient ? "text-white/70" : "text-muted-foreground"
                )}
              >
                {new Date(m.sent_at).toLocaleTimeString("en-US", {
                  hour: "numeric",
                  minute: "2-digit",
                })}
                {m.urgent && (
                  <span className="ml-2 inline-flex items-center rounded-full bg-danger/15 text-danger px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider">
                    Urgent
                  </span>
                )}
              </div>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
