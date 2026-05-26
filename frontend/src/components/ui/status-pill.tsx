import { cn } from "@/lib/utils";
import type { PatientStatus, RiskLevel } from "@/types";

/**
 * Status pills now use a white background with a soft colored border and
 * colored dot + text. Consistent across patient status, risk, and any other
 * domain badge that wants the same visual treatment.
 */
const statusMap: Record<
  PatientStatus,
  { label: string; text: string; border: string; dot: string }
> = {
  ready: {
    label: "Ready",
    text: "text-info",
    border: "border-info/30",
    dot: "bg-info",
  },
  "at-risk": {
    label: "At-Risk",
    text: "text-danger",
    border: "border-danger/30",
    dot: "bg-danger",
  },
  "in-progress": {
    label: "In Progress",
    text: "text-warning",
    border: "border-warning/30",
    dot: "bg-warning",
  },
  discharged: {
    label: "Discharged",
    text: "text-success",
    border: "border-success/30",
    dot: "bg-success",
  },
  scheduled: {
    label: "Scheduled",
    text: "text-slate-600",
    border: "border-slate-300",
    dot: "bg-slate-400",
  },
};

const riskMap: Record<
  RiskLevel,
  { label: string; text: string; border: string; dot: string }
> = {
  low: {
    label: "Low risk",
    text: "text-success",
    border: "border-success/30",
    dot: "bg-success",
  },
  moderate: {
    label: "Moderate",
    text: "text-warning",
    border: "border-warning/30",
    dot: "bg-warning",
  },
  high: {
    label: "High risk",
    text: "text-danger",
    border: "border-danger/30",
    dot: "bg-danger",
  },
  critical: {
    label: "Critical",
    text: "text-rose-700",
    border: "border-rose-300",
    dot: "bg-rose-600",
  },
};

const pillBase =
  "inline-flex items-center gap-1.5 rounded-full bg-white border px-2.5 py-0.5 text-xs font-medium shadow-soft";

export function StatusPill({
  status,
  className,
}: {
  status: PatientStatus;
  className?: string;
}) {
  const s = statusMap[status];
  return (
    <span className={cn(pillBase, s.border, s.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function RiskPill({ risk, className }: { risk: RiskLevel; className?: string }) {
  const r = riskMap[risk];
  return (
    <span className={cn(pillBase, r.border, r.text, className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", r.dot)} />
      {r.label}
    </span>
  );
}
