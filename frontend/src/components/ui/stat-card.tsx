import { motion } from "framer-motion";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "./card";

interface StatCardProps {
  label: string;
  value: string | number;
  icon?: React.ReactNode;
  delta?: { value: number; positive?: boolean };
  hint?: string;
  accent?: "primary" | "success" | "warning" | "danger";
  children?: React.ReactNode;
  className?: string;
}

const accentMap = {
  primary: "bg-primary/10 text-primary",
  success: "bg-success/10 text-success",
  warning: "bg-warning/10 text-warning",
  danger: "bg-danger/10 text-danger",
};

export function StatCard({
  label,
  value,
  icon,
  delta,
  hint,
  accent = "primary",
  children,
  className,
}: StatCardProps) {
  const positive = delta?.positive ?? (delta?.value ?? 0) >= 0;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className="h-full"
    >
      <Card className={cn("card-hover h-full flex flex-col", className)}>
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {icon && (
                <div
                  className={cn(
                    "size-9 rounded-xl flex items-center justify-center [&_svg]:size-4",
                    accentMap[accent]
                  )}
                >
                  {icon}
                </div>
              )}
              <span className="text-sm font-medium text-muted-foreground">
                {label}
              </span>
            </div>
            {hint && (
              <span className="text-xs text-primary hover:underline cursor-pointer">
                {hint}
              </span>
            )}
          </div>
          <div className="mt-4 flex items-end gap-2">
            <div className="text-3xl font-bold tracking-tight">{value}</div>
            {delta && (
              <div
                className={cn(
                  "flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium mb-1",
                  positive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                )}
              >
                {positive ? (
                  <ArrowUpRight className="size-3" />
                ) : (
                  <ArrowDownRight className="size-3" />
                )}
                {Math.abs(delta.value)}
                {typeof delta.value === "number" && "%"}
              </div>
            )}
          </div>
          {children && <div className="mt-4">{children}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
}
