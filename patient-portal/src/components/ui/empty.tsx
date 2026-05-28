import { cn } from "@/lib/utils";

interface EmptyProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export function Empty({ icon, title, description, action, className }: EmptyProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center px-6 py-12 rounded-2xl bg-surface-subtle border border-dashed border-border",
        className
      )}
    >
      {icon && (
        <div className="mb-3 size-12 rounded-full bg-white shadow-soft flex items-center justify-center text-primary">
          {icon}
        </div>
      )}
      <h4 className="font-semibold text-foreground">{title}</h4>
      {description && (
        <p className="mt-1 text-sm text-muted-foreground max-w-sm">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
