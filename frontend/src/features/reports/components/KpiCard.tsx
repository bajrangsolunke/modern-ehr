import { cn } from "@/lib/utils";

type Tone = "default" | "success" | "warning" | "danger";

interface Props {
  label: string;
  value: React.ReactNode;
  helper?: string;
  icon?: React.ComponentType<{ className?: string }>;
  tone?: Tone;
}

const toneStyles: Record<Tone, string> = {
  default: "text-foreground",
  success: "text-emerald-600",
  warning: "text-amber-600",
  danger: "text-rose-600",
};

export function KpiCard({ label, value, helper, icon: Icon, tone = "default" }: Props) {
  return (
    <div className="flex-1 min-w-[140px] rounded-2xl bg-white border border-border shadow-soft p-4 flex flex-col gap-1">
      <div className="flex items-center gap-2 mb-1">
        {Icon && <Icon className="size-4 text-muted-foreground shrink-0" />}
        <span className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground truncate">
          {label}
        </span>
      </div>
      <span className={cn("text-2xl font-bold leading-none", toneStyles[tone])}>
        {value ?? "—"}
      </span>
      {helper && (
        <span className="text-[11px] text-muted-foreground mt-0.5">{helper}</span>
      )}
    </div>
  );
}
