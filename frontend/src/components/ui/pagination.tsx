import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { useState } from "react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

export const DEFAULT_PAGE_SIZE = 10;
export const PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

interface Props {
  page: number;
  pages: number;
  total: number;
  /** Items currently visible — used in "Showing N of T". */
  shown?: number;
  onChange: (page: number) => void;
  /** Singular noun for the entity being paginated. */
  noun?: string;
  /** Current rows per page. Pass to enable the page-size selector. */
  pageSize?: number;
  onPageSizeChange?: (size: number) => void;
  /** Hide pagination when there's only one page AND no size selector. */
  hideOnSinglePage?: boolean;
  /**
   * Pin to the viewport bottom so it stays visible as the table scrolls.
   * Defaults to true — most pages want this behavior.
   */
  sticky?: boolean;
}

/**
 * Pagination footer with optional page-size selector. Sticky-bottom by
 * default so it stays visible as the table content scrolls past it.
 *
 * Layout: "Showing 1–10 of 42 docs" · rows-per-page · page X of Y · prev/next.
 */
export function Pagination({
  page,
  pages,
  total,
  shown,
  onChange,
  noun = "item",
  pageSize,
  onPageSizeChange,
  hideOnSinglePage = false,
  sticky = true,
}: Props) {
  const safePages = Math.max(1, pages);
  const label = total === 1 ? noun : `${noun}s`;
  const showSizePicker = Boolean(pageSize && onPageSizeChange);

  if (
    hideOnSinglePage &&
    safePages <= 1 &&
    !showSizePicker &&
    shown === undefined
  ) {
    return null;
  }

  const start = total === 0 ? 0 : pageSize ? (page - 1) * pageSize + 1 : 1;
  const end =
    pageSize && shown !== undefined
      ? Math.min(total, (page - 1) * pageSize + shown)
      : shown ?? total;

  return (
    <div
      className={cn(
        "mt-4 flex items-center justify-between gap-3 flex-wrap",
        "rounded-2xl border border-border bg-white/90 backdrop-blur px-3 sm:px-4 py-2 shadow-soft",
        sticky && "sticky bottom-2 z-20"
      )}
    >
      <span className="text-xs sm:text-sm text-muted-foreground">
        {total === 0
          ? `No ${label}`
          : pageSize
          ? `Showing ${start}–${end} of ${total} ${label}`
          : shown !== undefined
          ? `Showing ${shown} of ${total}`
          : `${total} ${label}`}
      </span>

      <div className="flex items-center gap-2">
        {showSizePicker && (
          <PageSizeSelector
            value={pageSize as number}
            onChange={onPageSizeChange as (n: number) => void}
          />
        )}

        <Button
          variant="secondary"
          size="icon"
          className="size-9 rounded-full"
          disabled={page <= 1}
          onClick={() => onChange(Math.max(1, page - 1))}
          aria-label="Previous page"
        >
          <ChevronLeft className="size-3.5" />
        </Button>
        <span className="px-3 py-1 rounded-full bg-surface-subtle border border-border text-xs tabular-nums">
          Page <strong className="text-foreground">{page}</strong> of {safePages}
        </span>
        <Button
          size="icon"
          className="size-9 rounded-full"
          disabled={page >= safePages}
          onClick={() => onChange(Math.min(safePages, page + 1))}
          aria-label="Next page"
        >
          <ChevronRight className="size-3.5" />
        </Button>
      </div>
    </div>
  );
}

function PageSizeSelector({
  value,
  onChange,
}: {
  value: number;
  onChange: (n: number) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label="Rows per page"
          className="inline-flex items-center gap-1.5 h-9 rounded-full bg-surface-subtle border border-border px-3 text-xs font-medium ring-focus hover:bg-secondary transition"
        >
          <span className="text-muted-foreground">Rows</span>
          <span className="tabular-nums">{value}</span>
          <ChevronDown className="size-3.5 text-muted-foreground" />
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 rounded-2xl bg-white shadow-elev border border-border p-1 animate-fade-in"
        >
          <ul className="min-w-[120px]">
            {PAGE_SIZE_OPTIONS.map((n) => (
              <li key={n}>
                <button
                  type="button"
                  onClick={() => {
                    onChange(n);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between w-full px-3 py-1.5 rounded-xl text-sm hover:bg-surface-subtle transition",
                    n === value && "bg-surface-subtle font-semibold"
                  )}
                >
                  <span>{n} per page</span>
                  {n === value && (
                    <span className="size-1.5 rounded-full bg-primary" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
