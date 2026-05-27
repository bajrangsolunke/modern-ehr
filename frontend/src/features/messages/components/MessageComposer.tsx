import { useState } from "react";
import { Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  onSend: (body: string) => void;
}

export function MessageComposer({ onSend }: Props) {
  const [value, setValue] = useState("");

  const send = () => {
    if (!value.trim()) return;
    onSend(value);
    setValue("");
  };

  return (
    <div className="border-t border-border bg-white px-3 sm:px-4 py-3 flex items-center gap-2">
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            send();
          }
        }}
        placeholder="Type a message..."
        rows={1}
        className="flex-1 resize-none rounded-2xl border border-border bg-white px-3 py-2 text-sm ring-focus min-h-[40px] max-h-[120px]"
      />
      <Button
        type="button"
        onClick={send}
        disabled={!value.trim()}
        className={cn("h-10 px-4 shrink-0")}
      >
        <Send className="size-3.5" />
        Send
      </Button>
    </div>
  );
}
