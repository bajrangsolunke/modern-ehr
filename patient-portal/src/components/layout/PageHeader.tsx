import { ChevronLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  title: string;
  subtitle?: string;
  back?: boolean;
  onBack?: () => void;
  right?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, back, onBack, right, className }: Props) {
  return (
    <div className={cn("flex items-center justify-between gap-4 mb-6 lg:mb-8", className)}>
      <div className="flex items-center gap-3 min-w-0">
        {back && (
          <button
            onClick={onBack}
            className="size-10 rounded-full border border-border bg-white shadow-soft grid place-items-center hover:border-primary/40 transition shrink-0"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <div className="min-w-0">
          <h1 className="text-[28px] lg:text-[32px] font-bold tracking-tight leading-tight truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {right && (
        <div className="flex items-center gap-2 lg:gap-3 shrink-0">{right}</div>
      )}
    </div>
  );
}
