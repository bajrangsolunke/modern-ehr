import * as React from "react";
import { cn } from "@/lib/utils";

export type TextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>;

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(
          "flex w-full rounded-2xl border border-border bg-white px-4 py-3 text-sm shadow-soft transition-colors placeholder:text-muted-foreground/70 ring-focus disabled:cursor-not-allowed disabled:opacity-50 resize-y min-h-[6rem] leading-relaxed",
          className
        )}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";

export { Textarea };
