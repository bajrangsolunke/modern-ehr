import { useEffect, useRef, useState } from "react";
import { FileText, Image as ImageIcon, Loader2, Paperclip, Send, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { AttachmentPicker } from "./AttachmentPicker";
import type { Document } from "@/features/docs/api/docs-api";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (body: string, attachments: Document[]) => void | Promise<void>;
  busy?: boolean;
  /** Called at most once per ~2s while the user is typing — drives
   *  the "X is typing…" indicator on the other side. */
  onTyping?: () => void;
  /** When provided, renders a "Suggest reply" button that calls this
   *  to fetch an LLM-drafted reply, then inserts it into the composer
   *  for the user to edit before sending. */
  onSuggest?: () => Promise<string>;
  /** When provided, the paperclip opens a picker over the patient's
   *  chart documents. Without a patientId, attachments are disabled. */
  patientId?: string;
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

export function MessageComposer({
  onSend,
  busy,
  onTyping,
  onSuggest,
  patientId,
}: Props) {
  const [value, setValue] = useState("");
  const [attachments, setAttachments] = useState<Document[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const lastTypingAtRef = useRef<number>(0);

  // Reset throttle + clear staged attachments when the conversation
  // changes so a left-over draft doesn't follow you to a new thread.
  useEffect(() => {
    lastTypingAtRef.current = 0;
    setAttachments([]);
  }, [onTyping]);

  const trimmed = value.trim();
  const canSend = (trimmed.length > 0 || attachments.length > 0) && !busy;

  const send = async () => {
    if (!canSend) return;
    const body = trimmed;
    const atts = attachments;
    setValue("");
    setAttachments([]);
    await onSend(body, atts);
    textareaRef.current?.focus();
  };

  const handleChange = (next: string) => {
    setValue(next);
    if (!onTyping) return;
    const now = Date.now();
    if (now - lastTypingAtRef.current > TYPING_THROTTLE_MS) {
      lastTypingAtRef.current = now;
      onTyping();
    }
  };

  const insertQuickReply = (text: string) => {
    setValue((cur) => (cur.trim() ? `${cur} ${text}` : text));
    textareaRef.current?.focus();
  };

  const toggleAttachment = (doc: Document) => {
    setAttachments((cur) =>
      cur.some((a) => a.id === doc.id)
        ? cur.filter((a) => a.id !== doc.id)
        : [...cur, doc]
    );
  };

  const handleSuggest = async () => {
    if (!onSuggest || suggesting) return;
    setSuggesting(true);
    try {
      const suggestion = await onSuggest();
      if (suggestion) {
        setValue(suggestion);
        requestAnimationFrame(() => {
          const el = textareaRef.current;
          if (el) {
            el.focus();
            el.setSelectionRange(suggestion.length, suggestion.length);
          }
        });
      }
    } catch (err) {
      toast.error("Couldn't generate a suggestion", {
        description: err instanceof Error ? err.message : undefined,
      });
    } finally {
      setSuggesting(false);
    }
  };

  const selectedIds = new Set(attachments.map((a) => a.id));

  return (
    <div className="border-t border-border bg-white">
      <div className="px-3 sm:px-4 pt-2 pb-1 flex flex-wrap items-center gap-1.5">
        {onSuggest && (
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggesting || busy}
            className={cn(
              "text-[11px] px-2.5 py-1 rounded-full border inline-flex items-center gap-1 transition ring-focus",
              "bg-primary/10 border-primary/30 text-primary hover:bg-primary/15",
              "disabled:opacity-60 disabled:cursor-wait"
            )}
          >
            {suggesting ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Sparkles className="size-3" />
            )}
            {suggesting ? "Drafting…" : "Suggest reply"}
          </button>
        )}
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

      {attachments.length > 0 && (
        <div className="px-3 sm:px-4 pb-1.5 flex flex-wrap gap-1.5">
          {attachments.map((a) => (
            <span
              key={a.id}
              className="inline-flex items-center gap-1.5 pl-2 pr-1 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-medium"
            >
              <MiniGlyph mime={a.mimeType} />
              <span className="max-w-[180px] truncate">{a.name}</span>
              <button
                type="button"
                onClick={() => toggleAttachment(a)}
                className="size-4 grid place-items-center rounded-full hover:bg-primary/20 transition"
                aria-label={`Remove ${a.name}`}
              >
                <X className="size-3" />
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="px-3 sm:px-4 pb-3 flex items-end gap-2">
        {patientId ? (
          <div className="relative">
            <AttachmentPicker
              patientId={patientId}
              selectedIds={selectedIds}
              onToggle={toggleAttachment}
              disabled={busy}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() =>
              toast.info("Attachments coming soon", {
                description:
                  "Clinician-to-clinician attachments land in a later phase.",
              })
            }
            aria-label="Attach (patient threads only)"
            className="size-10 shrink-0 rounded-full bg-surface-subtle text-muted-foreground hover:bg-secondary hover:text-foreground grid place-items-center transition ring-focus"
          >
            <Paperclip className="size-4" />
          </button>
        )}
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

function MiniGlyph({ mime }: { mime: string }) {
  if (mime.startsWith("image/")) return <ImageIcon className="size-3" />;
  return <FileText className="size-3" />;
}
