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
    <div className={cn("flex flex-wrap items-center justify-between gap-4 mb-6", className)}>
      <div className="flex items-center gap-3">
        {back && (
          <button
            onClick={onBack}
            className="size-9 rounded-full border border-border bg-white shadow-soft grid place-items-center hover:border-primary/40 transition"
          >
            <ChevronLeft className="size-4" />
          </button>
        )}
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {subtitle && (
            <p className="text-sm text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {right && <div className="flex items-center gap-2 flex-wrap">{right}</div>}
    </div>
  );
}
