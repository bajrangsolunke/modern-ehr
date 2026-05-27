import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "./button";

interface Props {
  page: number;
  pages: number;
  total: number;
  /** Items currently visible — used in "Showing N of T". */
  shown?: number;
  onChange: (page: number) => void;
  /** Singular noun for the entity being paginated. */
  noun?: string;
}

/**
 * Standard list pagination: "Showing N of T" on the left, prev /
 * "Page X of Y" pill / next on the right. Hides the controls
 * entirely when there's only one page.
 */
export function Pagination({
  page,
  pages,
  total,
  shown,
  onChange,
  noun = "item",
}: Props) {
  const safePages = Math.max(1, pages);
  const label = total === 1 ? noun : `${noun}s`;

  return (
    <div className="mt-6 flex items-center justify-between text-sm text-muted-foreground">
      <span>
        {shown !== undefined
          ? `Showing ${shown} of ${total}`
          : `${total} ${label}`}
      </span>
      {safePages > 1 && (
        <div className="flex items-center gap-2">
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
          <span className="px-3 py-1 rounded-full bg-white border border-border text-xs">
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
      )}
    </div>
  );
}
