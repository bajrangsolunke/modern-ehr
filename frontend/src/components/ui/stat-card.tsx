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
        <CardContent className="p-5 lg:p-6 flex flex-col h-full">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              {icon && (
                <div
                  className={cn(
                    "size-10 rounded-2xl flex items-center justify-center [&_svg]:size-5",
                    accentMap[accent]
                  )}
                >
                  {icon}
                </div>
              )}
              <span className="text-[15px] font-semibold text-foreground">
                {label}
              </span>
            </div>
            {hint && (
              <button className="text-[13px] font-medium text-primary hover:underline">
                {hint}
              </button>
            )}
          </div>

          <div className="mt-4 flex items-center gap-2.5">
            <div className="text-[40px] leading-none font-bold tracking-tight">
              {value}
            </div>
            {delta && (
              <div
                className={cn(
                  "flex items-center gap-0.5 rounded-full px-2 py-1 text-[12px] font-semibold",
                  positive ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
                )}
              >
                {positive ? (
                  <ArrowUpRight className="size-3.5" />
                ) : (
                  <ArrowDownRight className="size-3.5" />
                )}
                {positive ? "+" : "-"}
                {Math.abs(delta.value)}
                {typeof delta.value === "number" && "%"}
              </div>
            )}
          </div>

          {children && <div className="mt-5 flex-1">{children}</div>}
        </CardContent>
      </Card>
    </motion.div>
  );
}
