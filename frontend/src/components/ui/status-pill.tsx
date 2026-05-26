import { cn } from "@/lib/utils";
import type { PatientStatus, RiskLevel } from "@/types";

const statusMap: Record<PatientStatus, { label: string; cls: string; dot: string }> = {
  ready: { label: "Ready", cls: "bg-info/10 text-info", dot: "bg-info" },
  "at-risk": { label: "At-Risk", cls: "bg-danger/10 text-danger", dot: "bg-danger" },
  "in-progress": {
    label: "In Progress",
    cls: "bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  discharged: {
    label: "Discharged",
    cls: "bg-success/10 text-success",
    dot: "bg-success",
  },
  scheduled: {
    label: "Scheduled",
    cls: "bg-slate-100 text-slate-600",
    dot: "bg-slate-400",
  },
};

const riskMap: Record<RiskLevel, { label: string; cls: string; dot: string }> = {
  low: { label: "Low risk", cls: "bg-success/10 text-success", dot: "bg-success" },
  moderate: {
    label: "Moderate",
    cls: "bg-warning/10 text-warning",
    dot: "bg-warning",
  },
  high: { label: "High risk", cls: "bg-danger/10 text-danger", dot: "bg-danger" },
  critical: {
    label: "Critical",
    cls: "bg-rose-100 text-rose-700",
    dot: "bg-rose-600",
  },
};

export function StatusPill({ status, className }: { status: PatientStatus; className?: string }) {
  const s = statusMap[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        s.cls,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", s.dot)} />
      {s.label}
    </span>
  );
}

export function RiskPill({ risk, className }: { risk: RiskLevel; className?: string }) {
  const r = riskMap[risk];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        r.cls,
        className
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", r.dot)} />
      {r.label}
    </span>
  );
}
