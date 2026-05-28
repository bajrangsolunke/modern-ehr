import { useEffect, useState, type FormEvent } from "react";
import { Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  disabled?: boolean;
  pending?: boolean;
  seed?: string;
  onSend: (body: string) => Promise<void> | void;
}

export function MessageComposer({ disabled, pending, seed, onSend }: Props) {
  const [body, setBody] = useState("");

  useEffect(() => {
    if (seed) setBody(seed);
  }, [seed]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = body.trim();
    if (!trimmed || disabled || pending) return;
    await onSend(trimmed);
    setBody("");
  };

  return (
    <form
      onSubmit={submit}
      className="flex items-end gap-2 border-t border-border bg-white px-4 py-3 rounded-b-2xl"
    >
      <textarea
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
  );
}
