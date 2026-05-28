import { useState, type ReactNode } from "react";
import { Filter } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { Button } from "./button";

interface PopoverProps {
  activeCount: number;
  /** Render-prop that gets a `close` callback for use inside the body
   *  (e.g. Reset button that should both clear filters and close). */
  renderBody: (close: () => void) => ReactNode;
}

/**
 * Pill-shaped Filters trigger with a count badge + popover.
 * Body is render-prop so each consumer can structure its own
 * FilterGroup rows.
 */
export function FilterPopover({ activeCount, renderBody }: PopoverProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="secondary" className="h-10 rounded-full px-4 relative">
          <Filter className="size-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 inline-grid place-items-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[min(92vw,420px)] rounded-2xl bg-white shadow-elev border border-border p-4 animate-fade-in"
        >
          {renderBody(() => setOpen(false))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

export function FilterHeader({
  title = "Filters",
  onClear,
}: {
  title?: string;
  onClear: () => void;
}) {
  return (
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <button
        type="button"
        onClick={onClear}
        className="text-xs text-muted-foreground hover:text-foreground"
      >
        Reset
      </button>
    </div>
  );
}

export function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-2 mb-4 last:mb-0">
      <div className="text-[11px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}
