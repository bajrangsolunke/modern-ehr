import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface Props {
  total: number;
  finished: number;
  upcoming: number;
  label?: string;
  delta?: number;
  variant?: "primary" | "warning";
  className?: string;
  title: string;
}

export function SurgeryRing({
  total,
  finished,
  upcoming,
  label = "Total interventions",
  delta,
  variant = "primary",
  className,
  title,
}: Props) {
  const finishedPct = Math.round((finished / total) * 100);
  const upcomingPct = 100 - finishedPct;

  const ringColor =
    variant === "warning"
      ? "stroke-warning"
      : "stroke-primary";
  const finishedDot =
    variant === "warning" ? "bg-warning" : "bg-primary";
  const upcomingDot =
    variant === "warning" ? "bg-warning/30" : "bg-primary/30";

  return (
    <div className={cn("rounded-2xl bg-card shadow-card border border-border p-5", className)}>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-sm">{title}</h3>
      </div>
      <div className="flex items-center gap-6">
        <div className="relative size-32 shrink-0">
          <svg viewBox="0 0 100 100" className="size-full -rotate-90">
            <circle
              cx="50"
              cy="50"
              r="42"
              className="stroke-secondary"
              strokeWidth="10"
              fill="none"
            />
            <motion.circle
              cx="50"
              cy="50"
              r="42"
              className={ringColor}
              strokeWidth="10"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={2 * Math.PI * 42}
              initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
              animate={{
                strokeDashoffset:
                  2 * Math.PI * 42 - (2 * Math.PI * 42 * finishedPct) / 100,
              }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="text-3xl font-bold tracking-tight">{total}</div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                {label}
              </div>
              {typeof delta === "number" && (
                <div className="mt-0.5 text-xs text-success">+{delta}</div>
              )}
            </div>
          </div>
          <div className="absolute right-1 top-1 text-xs font-semibold text-muted-foreground">
            {finishedPct}%
          </div>
          <div className="absolute left-0 bottom-2 text-xs font-semibold text-muted-foreground">
            {upcomingPct}%
          </div>
        </div>

        <div className="flex flex-col gap-2.5 text-sm">
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", finishedDot)} />
            <span className="font-semibold">{finished}</span>
            <span className="text-muted-foreground">Finished</span>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 rounded-full", upcomingDot)} />
            <span className="font-semibold">{upcoming}</span>
            <span className="text-muted-foreground">Upcoming</span>
          </div>
        </div>
      </div>
    </div>
  );
}
