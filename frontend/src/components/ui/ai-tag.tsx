import { Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function AiTag({ children, className }: { children?: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider",
        className
      )}
    >
      <Sparkles className="size-3" />
      {children ?? "AI"}
    </span>
  );
}
