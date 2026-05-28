import { useEffect, useRef, useState, type FormEvent } from "react";
import { Send, Loader2, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

interface Props {
  disabled?: boolean;
  pending?: boolean;
  /** Returns one suggestion string; the composer drops it into the
   *  textarea and focuses for editing. Throws to surface errors. */
  onSuggest?: () => Promise<string | null>;
  onSend: (body: string) => Promise<void> | void;
}

export function MessageComposer({ disabled, pending, onSuggest, onSend }: Props) {
  const [body, setBody] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setBody("");
  }, [disabled]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || disabled || pending) return;
    await onSend(trimmed);
    setBody("");
  };

  const handleSuggest = async () => {
    if (!onSuggest || suggesting) return;
    setSuggesting(true);
    try {
      const suggestion = await onSuggest();
      if (suggestion) {
        setBody(suggestion);
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

  return (
    <div className="border-t border-border bg-white">
      {onSuggest && (
        <div className="px-3 sm:px-4 pt-2 pb-1 flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleSuggest}
            disabled={suggesting || pending || disabled}
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
        </div>
      )}

      <form onSubmit={submit} className="flex items-end gap-2 px-3 sm:px-4 py-3">
        <textarea
          ref={textareaRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Message your care team…"
          rows={1}
          disabled={disabled}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void submit(e);
            }
          }}
          className="flex-1 resize-none rounded-2xl border border-border bg-white px-4 py-2 text-sm leading-relaxed ring-focus min-h-[40px] max-h-32 placeholder:text-muted-foreground/70"
        />
        <Button
          type="submit"
          size="icon"
          disabled={disabled || pending || body.trim().length === 0}
          aria-label="Send"
        >
          {pending ? <Loader2 className="animate-spin" /> : <Send />}
        </Button>
      </form>
    </div>
  );
}
