import { AlertOctagon, RotateCw } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function ErrorBanner({
  title = "Couldn't load",
  message,
  onRetry,
  retrying,
  className,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger/5 p-4",
        className
      )}
    >
      <div className="size-9 rounded-xl bg-danger/10 text-danger grid place-items-center shrink-0">
        <AlertOctagon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          disabled={retrying}
        >
          <RotateCw className={cn("size-3.5", retrying && "animate-spin")} />
          {retrying ? "Retrying…" : "Retry"}
        </Button>
      )}
    </div>
  );
}
