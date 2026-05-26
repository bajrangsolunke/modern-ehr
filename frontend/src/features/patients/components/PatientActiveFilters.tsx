import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PatientFilters } from "@/features/patients/api/patients-api";

interface Props {
  filters: PatientFilters;
  onChange: (next: PatientFilters) => void;
  /** Display map for assigned physician chips. Optional. */
  physicians?: { id: string; name: string }[];
  className?: string;
}

interface ActiveChip {
  key: keyof PatientFilters;
  label: string;
}

/**
 * Row of removable chips below the search box, one per active facet.
 * Renders nothing when no filters are set.
 */
export function PatientActiveFilters({
  filters,
  onChange,
  physicians = [],
  className,
}: Props) {
  const chips: ActiveChip[] = [];
  if (filters.status) chips.push({ key: "status", label: `Status: ${labelize(filters.status)}` });
  if (filters.risk) chips.push({ key: "risk", label: `Risk: ${labelize(filters.risk)}` });
  if (filters.asa) chips.push({ key: "asa", label: `ASA ${filters.asa}` });
  if (filters.icu_needed !== undefined) {
    chips.push({
      key: "icu_needed",
      label: filters.icu_needed ? "ICU required" : "ICU not required",
    });
  }
  if (filters.physician_id) {
    const name =
      physicians.find((p) => p.id === filters.physician_id)?.name ?? "Physician";
    chips.push({ key: "physician_id", label: `Physician: ${name}` });
  }

  if (chips.length === 0) return null;

  const clear = (key: keyof PatientFilters) => {
    const next: PatientFilters = { ...filters, page: 1 };
    delete (next as Record<string, unknown>)[key];
    onChange(next);
  };

  const clearAll = () => {
    onChange({
      q: filters.q,
      sort_by: filters.sort_by,
      sort_dir: filters.sort_dir,
      page: 1,
      page_size: filters.page_size,
    });
  };

  return (
    <div className={cn("flex items-center gap-2 flex-wrap mt-3", className)}>
      <span className="text-xs text-muted-foreground">Active filters:</span>
      {chips.map((c) => (
        <span
          key={c.key}
          className="inline-flex items-center gap-1.5 rounded-full bg-white border border-border px-3 py-1 text-xs font-medium shadow-soft"
        >
          {c.label}
          <button
            type="button"
            aria-label={`Remove ${c.label}`}
            onClick={() => clear(c.key)}
            className="size-4 grid place-items-center rounded-full hover:bg-secondary"
          >
            <X className="size-3" />
          </button>
        </span>
      ))}
      <button
        type="button"
        onClick={clearAll}
        className="text-xs text-primary hover:underline ml-1"
      >
        Clear all
      </button>
    </div>
  );
}

function labelize(v: string): string {
  return v
    .split(/[-_]/)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}
