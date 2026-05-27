import * as React from "react";
import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";

type Tone = "primary" | "info" | "success" | "warning" | "danger" | "neutral" | "muted";

const TONE_CLASS: Record<Tone, string> = {
  primary: "text-primary",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-muted-foreground",
  muted: "text-muted-foreground",
};

interface Props {
  label: string;
  value: React.ReactNode;
  icon?: React.ReactNode;
  hint?: string;
  tone?: Tone;
  className?: string;
}

/**
 * Compact summary stat — a label + big number + optional icon on the
 * left + optional hint line below. Used on every dashboard / stats
 * row across the app (Users, Appointments, User detail, etc.).
 */
export function SummaryTile({
  label,
  value,
  icon,
  hint,
  tone = "primary",
  className,
}: Props) {
  return (
    <Card className={className}>
      <CardContent className="p-4 flex items-start gap-3">
        {icon && (
          <div
            className={cn(
              "size-10 rounded-2xl bg-surface-subtle grid place-items-center [&_svg]:size-5",
              TONE_CLASS[tone]
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
            {label}
          </div>
          <div
            className={cn(
              "text-2xl font-bold tracking-tight",
              !icon && TONE_CLASS[tone]
            )}
          >
            {value}
          </div>
          {hint && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {hint}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
