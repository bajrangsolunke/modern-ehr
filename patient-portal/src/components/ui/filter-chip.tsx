import * as React from "react";
import { cn } from "@/lib/utils";

interface Props {
  label: React.ReactNode;
  active: boolean;
  onClick: () => void;
  /** Optional colored dot used by status-flavored chips. */
  tone?: "neutral" | "success" | "muted";
  /** When true, the inactive state uses a dashed border instead of solid. */
  dashed?: boolean;
  className?: string;
}

const ACTIVE_TONE = {
  neutral: "bg-slate-900 text-white border-slate-900",
  success: "border-success/40 bg-success/10 text-success",
  muted: "border-slate-400/40 bg-slate-100 text-slate-700",
} as const;

const DOT_TONE = {
  neutral: "",
  success: "bg-success",
  muted: "bg-slate-400",
} as const;

/**
 * Toggleable filter pill. Used for role / status / preset filter
 * rows. Two visual flavors:
 *  - solid (default): dark slate when active, white outline when not.
 *  - dashed (border-dashed): used for status chips that should read
 *    as "soft" affordances vs. the primary role chips.
 */
export function FilterChip({
  label,
  active,
  onClick,
  tone = "neutral",
  dashed,
  className,
}: Props) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex items-center gap-1.5 px-3 h-8 rounded-full text-xs font-medium border bg-white transition ring-focus",
        active
          ? ACTIVE_TONE[tone]
          : cn(
              "border-border text-muted-foreground hover:text-foreground hover:border-foreground/30",
              dashed && "border-dashed"
            ),
        className
      )}
    >
      {tone !== "neutral" && (
        <span className={cn("h-1.5 w-1.5 rounded-full", DOT_TONE[tone])} />
      )}
      {label}
    </button>
  );
}
