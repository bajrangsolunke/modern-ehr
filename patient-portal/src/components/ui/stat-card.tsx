import { cn } from "@/lib/utils";
import { Card, CardContent } from "./card";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  hint?: string;
  accent?: "primary" | "success" | "warning" | "danger" | "info";
  className?: string;
}

const ACCENT: Record<NonNullable<StatCardProps["accent"]>, string> = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
  info: "bg-info/10 text-info",
};

export function StatCard({
  label,
  value,
  icon,
  hint,
  accent = "primary",
  className,
}: StatCardProps) {
  return (
    <Card className={cn("h-full", className)}>
      <CardContent className="px-5 py-5 h-full flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-muted-foreground">
            {label}
          </span>
          {icon && (
            <div
              className={cn(
                "size-9 rounded-xl grid place-items-center [&_svg]:size-4",
                ACCENT[accent]
              )}
            >
              {icon}
            </div>
          )}
        </div>
        <div className="text-3xl font-bold tabular-nums leading-none">
          {value}
        </div>
        {hint && (
          <div className="text-xs text-muted-foreground mt-auto">{hint}</div>
        )}
      </CardContent>
    </Card>
  );
}
