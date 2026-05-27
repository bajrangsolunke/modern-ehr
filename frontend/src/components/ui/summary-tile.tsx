import * as React from "react";
import { Card, CardContent } from "./card";
import { cn } from "@/lib/utils";

type Tone =
  | "primary"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "neutral"
  | "muted";

const TONE_TEXT: Record<Tone, string> = {
  primary: "text-primary",
  info: "text-info",
  success: "text-success",
  warning: "text-warning",
  danger: "text-danger",
  neutral: "text-muted-foreground",
  muted: "text-muted-foreground",
};
const TONE_BG: Record<Tone, string> = {
  primary: "bg-primary/10",
  info: "bg-info/10",
  success: "bg-success/10",
  warning: "bg-warning/10",
  danger: "bg-danger/10",
  neutral: "bg-slate-100",
  muted: "bg-slate-100",
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
 * Compact metric card used on every stats row across the app
 * (Users, Appointments, User detail, …).
 *
 * Layout: tinted icon on the left → label + big number on the
 * right. Card height ~64 px which is short enough for the header,
 * stat row, and a toolbar to all fit above the fold on a typical
 * 14" laptop.
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
      <CardContent className="px-3 py-2.5 flex items-center gap-3">
        {icon && (
          <div
            className={cn(
              "size-9 rounded-xl grid place-items-center shrink-0 [&_svg]:size-4",
              TONE_BG[tone],
              TONE_TEXT[tone]
            )}
          >
            {icon}
          </div>
        )}
        <div className="min-w-0 flex-1 flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold leading-tight">
              {label}
            </div>
            {hint && (
              <div className="text-[10px] text-muted-foreground mt-0.5 truncate">
                {hint}
              </div>
            )}
          </div>
          <div
            className={cn(
              "text-xl font-bold tabular-nums shrink-0",
              TONE_TEXT[tone]
            )}
          >
            {value}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
