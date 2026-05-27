/**
 * Repeatable list of rows with an "Add More" affordance + trash icon
 * per row. Children render the inputs for a single row; the parent
 * manages the array of values.
 */
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props<T> {
  items: T[];
  /** Returns a fresh empty row when the user clicks "Add More". */
  newItem: () => T;
  onChange: (next: T[]) => void;
  /** Children-as-function: receives the current row + setter for it. */
  renderRow: (
    row: T,
    setRow: (next: T) => void,
    index: number
  ) => React.ReactNode;
  /** Label for the "Add More" button. Defaults to "Add More". */
  addLabel?: string;
  /** Hide the delete button when only one row remains. */
  alwaysAllowDelete?: boolean;
}

export function RepeatableList<T>({
  items,
  newItem,
  onChange,
  renderRow,
  addLabel = "Add More",
  alwaysAllowDelete,
}: Props<T>) {
  const setAt = (idx: number, next: T) => {
    const copy = items.slice();
    copy[idx] = next;
    onChange(copy);
  };

  const removeAt = (idx: number) => {
    const next = items.slice();
    next.splice(idx, 1);
    onChange(next);
  };

  const add = () => onChange([...items, newItem()]);

  const visibleItems = items.length === 0 ? [newItem()] : items;
  const isStarter = items.length === 0;

  return (
    <div className="space-y-2">
      {visibleItems.map((row, idx) => (
        <div key={idx} className="flex items-start gap-2">
          <div className="flex-1 min-w-0">
            {renderRow(
              row,
              (next) => {
                if (isStarter) {
                  // First row gets persisted lazily — only on first
                  // change does it materialize.
                  onChange([next]);
                } else {
                  setAt(idx, next);
                }
              },
              idx
            )}
          </div>
          <button
            type="button"
            onClick={() => removeAt(idx)}
            disabled={!alwaysAllowDelete && isStarter}
            aria-label="Remove row"
            className="size-9 grid place-items-center rounded-full text-muted-foreground hover:bg-rose-50 hover:text-danger transition disabled:opacity-30 disabled:cursor-not-allowed shrink-0 mt-1"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={add}
        className="text-primary font-semibold hover:text-primary hover:bg-primary/5"
      >
        <Plus className="size-3.5" />
        {addLabel}
      </Button>
    </div>
  );
}
