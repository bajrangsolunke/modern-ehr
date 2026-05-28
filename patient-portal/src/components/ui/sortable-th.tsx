import * as React from "react";
import { ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

const HEADER_BG = "#FFFFFF";
const HEADER_SHADOW = "0 4px 12px rgba(17,24,39,0.06)";

interface Props {
  children: React.ReactNode;
  /** First column gets a left-rounded corner. */
  first?: boolean;
  /** Trailing right-aligned column (no sort icon). */
  last?: boolean;
  className?: string;
}

/**
 * Table header cell matching the app's "pill row" table treatment
 * (white shadow-capped header, gray-pill rows). The default flavor
 * shows a `ChevronsUpDown` icon to suggest sortability; pass
 * `last` for non-sortable action columns at the right edge.
 */
export function SortableTh({ children, first, last, className }: Props) {
  return (
    <th
      className={cn(
        "font-medium px-4 py-2",
        first && "first:rounded-l-full",
        last && "text-right last:rounded-r-full",
        className
      )}
      style={{ background: HEADER_BG, boxShadow: HEADER_SHADOW }}
    >
      {last ? (
        children
      ) : (
        <button
          type="button"
          className="inline-flex items-center gap-1 hover:text-foreground transition"
        >
          {children}
          <ChevronsUpDown className="size-3 opacity-60" />
        </button>
      )}
    </th>
  );
}

/** Row background used across the app's table styling. */
export const TABLE_ROW_BG = "#F5F7FB";
