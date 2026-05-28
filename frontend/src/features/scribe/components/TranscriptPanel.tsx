/**
 * Scrollable read-only transcript panel that auto-scrolls to the bottom.
 */
import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface TranscriptPanelProps {
  transcript: string;
  className?: string;
}

export function TranscriptPanel({ transcript, className }: TranscriptPanelProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  return (
    <div
      className={cn(
        "flex-1 overflow-y-auto rounded-2xl border border-border bg-surface-subtle p-4 min-h-[200px]",
        className
      )}
    >
      {transcript ? (
        <p className="text-sm font-mono leading-relaxed whitespace-pre-wrap text-foreground">
          {transcript}
        </p>
      ) : (
        <p className="text-sm text-muted-foreground italic text-center mt-8">
          Transcript will appear here as you speak…
        </p>
      )}
      <div ref={bottomRef} />
    </div>
  );
}
