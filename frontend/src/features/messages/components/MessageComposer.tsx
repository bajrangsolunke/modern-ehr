import { useEffect, useRef, useState } from "react";
import { Loader2, Paperclip, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (body: string) => void | Promise<void>;
  busy?: boolean;
  /** Called at most once per ~2s while the user is typing — drives
   *  the "X is typing…" indicator on the other side. */
  onTyping?: () => void;
}

const TYPING_THROTTLE_MS = 2_000;

/**
 * Common provider replies. Tapping a chip inserts the text into the
 * composer so it can be edited before sending. Picked for high-volume
 * use-cases:
 *   • appointment confirmations (the #1 incoming patient question)
 *   • acknowledging messages while triaging
 *   • prep instructions / lab follow-ups
 */
const QUICK_REPLIES = [
  "Confirmed — see you then.",
  "Thanks, I'll review and get back to you.",
  "Please arrive 15 minutes early to complete forms.",
  "Lab results look normal — no follow-up needed.",
];

export function MessageComposer({ onSend, busy, onTyping }: Props) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastTypingAtRef = useRef<number>(0);

  const trimmed = value.trim();
  const canSend = trimmed.length > 0 && !busy;

  // Reset throttle when the conversation changes so the next keystroke
  // pings immediately.
  useEffect(() => {
    lastTypingAtRef.current = 0;
  }, [onTyping]);

  const handleChange = (next: string) => {
    setValue(next);
    if (!onTyping) return;
    const now = Date.now();
    if (now - lastTypingAtRef.current > TYPING_THROTTLE_MS) {
      lastTypingAtRef.current = now;
      onTyping();
    }
  };

  const send = async () => {
    if (!canSend) return;
    const body = trimmed;
    setValue("");
    await onSend(body);
    textareaRef.current?.focus();
  };

  const insertQuickReply = (text: string) => {
    setValue((cur) => (cur.trim() ? `${cur} ${text}` : text));
    textareaRef.current?.focus();
  };

  return (
    <div className="border-t border-border bg-white">
      <div className="px-3 sm:px-4 pt-2 pb-1 flex flex-wrap gap-1.5">
        {QUICK_REPLIES.map((q) => (
          <button
            key={q}
            type="button"
            onClick={() => insertQuickReply(q)}
            className="text-[11px] px-2.5 py-1 rounded-full bg-surface-subtle border border-border text-muted-foreground hover:bg-secondary hover:text-foreground transition ring-focus"
          >
            {q}
          </button>
        ))}
      </div>

      <div className="px-3 sm:px-4 pb-3 flex items-end gap-2">
        <button
          type="button"
          onClick={() =>
            toast.info("Attachments coming soon", {
              description: "Attach a document from the patient's chart.",
            })
          }
          aria-label="Attach"
          className="size-10 shrink-0 rounded-full bg-surface-subtle text-muted-foreground hover:bg-secondary hover:text-foreground grid place-items-center transition ring-focus"
        >
          <Paperclip className="size-4" />
        </button>
        <textarea
          ref={textareaRef}
          value={value}
          onChange={(e) => handleChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Type a message..."
          rows={1}
          disabled={busy}
          className={cn(
            "flex-1 resize-none rounded-2xl border border-border bg-white px-3.5 py-2.5 text-sm ring-focus min-h-[40px] max-h-[140px]",
            "disabled:opacity-60"
          )}
        />
        <Button
          type="button"
          onClick={send}
          disabled={!canSend}
          className="h-10 px-4 shrink-0"
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Send className="size-3.5" />
          )}
          Send
        </Button>
      </div>
    </div>
  );
}
