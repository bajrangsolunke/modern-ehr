import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export function Spinner({
  size = "md",
  className,
  label,
}: {
  size?: "sm" | "md" | "lg";
  className?: string;
  label?: string;
}) {
  const sizes = { sm: "size-4", md: "size-6", lg: "size-8" };
  return (
    <div
      className={cn("inline-flex items-center gap-2 text-muted-foreground", className)}
      role="status"
      aria-label={label ?? "Loading"}
    >
      <Loader2 className={cn(sizes[size], "animate-spin text-primary")} />
      {label && <span className="text-sm">{label}</span>}
    </div>
  );
}

export function PageSpinner({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="min-h-[40vh] grid place-items-center">
      <Spinner size="lg" label={label} />
    </div>
  );
}
