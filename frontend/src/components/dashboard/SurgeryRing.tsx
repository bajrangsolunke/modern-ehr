import { motion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
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

  const ringColor = variant === "warning" ? "#F59E0B" : "#4F8CFF";
  const ringSoft = variant === "warning" ? "#FEF3C7" : "#DCE8FF";
  const finishedDot = variant === "warning" ? "bg-warning" : "bg-primary";
  const upcomingDot = variant === "warning" ? "bg-warning/30" : "bg-primary/30";

  const radius = 56;
  const circumference = 2 * Math.PI * radius;

  return (
    <div
      className={cn(
        "rounded-2xl bg-card shadow-card border border-border p-5 lg:p-6 h-full",
        className
      )}
    >
      <div className="flex items-center justify-between mb-4 lg:mb-6">
        <h3 className="font-semibold text-sm lg:text-base">{title}</h3>
      </div>

      <div className="flex items-center gap-5 lg:gap-8">
        <div className="relative shrink-0">
          <svg width="160" height="160" viewBox="0 0 160 160" className="-rotate-90">
            <circle
              cx="80"
              cy="80"
              r={radius}
              stroke={ringSoft}
              strokeWidth="14"
              fill="none"
              strokeLinecap="round"
            />
            <motion.circle
              cx="80"
              cy="80"
              r={radius}
              stroke={ringColor}
              strokeWidth="14"
              strokeLinecap="round"
              fill="none"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{
                strokeDashoffset:
                  circumference - (circumference * finishedPct) / 100,
              }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 grid place-items-center">
            <div className="text-center">
              <div className="text-3xl lg:text-4xl font-bold tracking-tight leading-none">
                {total}
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground max-w-[100px] mx-auto leading-tight">
                {label}
              </div>
              {typeof delta === "number" && (
                <div className="mt-1.5 inline-flex items-center gap-0.5 text-[11px] font-semibold text-success">
                  <ArrowUpRight className="size-3" /> +{delta}
                </div>
              )}
            </div>
          </div>

          <span
            className="absolute top-2 right-1 text-[11px] font-semibold"
            style={{ color: ringColor }}
          >
            {finishedPct}%
          </span>
          <span className="absolute bottom-3 left-1 text-[11px] font-semibold text-muted-foreground">
            {upcomingPct}%
          </span>
        </div>

        <div className="flex flex-col gap-3 text-sm flex-1 min-w-0">
          <div className="flex items-baseline gap-2">
            <span className={cn("h-2 w-2 rounded-full shrink-0", finishedDot)} />
            <span className="font-bold text-lg">{finished}</span>
            <span className="text-muted-foreground text-sm">
              Number of finished {variant === "warning" ? "At-risk " : ""}interventions
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className={cn("h-2 w-2 rounded-full shrink-0", upcomingDot)} />
            <span className="font-bold text-lg">{upcoming}</span>
            <span className="text-muted-foreground text-sm">
              Number of upcoming {variant === "warning" ? "At-risk " : ""}interventions
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
