import { Card } from "./card";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

export function TableSkeleton({ rows = 8, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="space-y-2">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-full" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-11 rounded-full" />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="size-10 rounded-2xl" />
        <Skeleton className="h-4 w-32 rounded-full" />
      </div>
      <Skeleton className="h-10 w-24 rounded-lg mb-4" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </Card>
  );
}
