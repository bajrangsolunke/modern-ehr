import { useEffect, useRef } from "react";
import { Check, CheckCheck } from "lucide-react";
import { UserAvatar } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import type { Message } from "@/features/messages/api/messages-api";

interface Props {
  messages: Message[];
  /** Highest `last_read_at` across staff participants — patient's
   *  outgoing bubbles sent at/before this time flip from ✓ to ✓✓. */
  staffLastReadAt?: string | null;
  /** When true, render the "Care team is typing…" pill above the
   *  composer. The patient portal doesn't resolve individual staff
   *  names so we just show the generic label. */
  staffTyping?: boolean;
}

export function MessageThread({
  messages,
  staffLastReadAt = null,
  staffTyping = false,
}: Props) {
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length, staffTyping]);

  if (messages.length === 0 && !staffTyping) {
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
        const read =
          fromPatient &&
          staffLastReadAt !== null &&
          m.sent_at <= staffLastReadAt;
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
                src={m.sender_avatar_url ?? undefined}
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
                  "text-[10px] mt-1 tabular-nums inline-flex items-center gap-1",
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
                {fromPatient &&
                  (read ? (
                    <CheckCheck
                      className="size-3 text-white"
                      aria-label="Read by care team"
                    />
                  ) : (
                    <Check
                      className="size-3 text-white/70"
                      aria-label="Sent"
                    />
                  ))}
              </div>
            </div>
          </div>
        );
      })}
      {staffTyping && <TypingIndicator />}
      <div ref={bottomRef} />
    </div>
  );
}

function TypingIndicator() {
  return (
    <div className="flex items-end gap-2">
      <UserAvatar name="Care team" size="sm" className="self-end" />
      <div className="bg-white border border-border rounded-2xl rounded-bl-md px-3.5 py-2 inline-flex items-center gap-2 shadow-soft">
        <span className="text-xs text-muted-foreground">
          Care team is typing
        </span>
        <span className="flex gap-1" aria-hidden="true">
          <Dot delay="0ms" />
          <Dot delay="150ms" />
          <Dot delay="300ms" />
        </span>
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: string }) {
  return (
    <span
      className="size-1.5 rounded-full bg-muted-foreground/70 animate-bounce"
      style={{ animationDelay: delay, animationDuration: "1s" }}
    />
  );
}
