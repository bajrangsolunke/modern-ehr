import * as Popover from "@radix-ui/react-popover";
import { Filter } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PatientFilters } from "@/features/patients/api/patients-api";

interface Props {
  filters: PatientFilters;
  onChange: (next: PatientFilters) => void;
  /** Optional physician options (id + display name). Keep small for now —
   *  Story 6.5 doesn't add a backend users-list endpoint. */
  physicians?: { id: string; name: string }[];
}

const STATUS_OPTIONS: { v: NonNullable<PatientFilters["status"]>; label: string }[] = [
  { v: "ready", label: "Ready" },
  { v: "at-risk", label: "At-risk" },
  { v: "in-progress", label: "In progress" },
  { v: "discharged", label: "Discharged" },
  { v: "scheduled", label: "Scheduled" },
];

const RISK_OPTIONS: { v: NonNullable<PatientFilters["risk"]>; label: string }[] = [
  { v: "low", label: "Low" },
  { v: "moderate", label: "Moderate" },
  { v: "high", label: "High" },
  { v: "critical", label: "Critical" },
];

const ASA_OPTIONS: NonNullable<PatientFilters["asa"]>[] = ["I", "II", "III", "IV"];

export function PatientFiltersPopover({ filters, onChange, physicians = [] }: Props) {
  const activeCount = countActive(filters);

  function setFacet<K extends keyof PatientFilters>(
    key: K,
    value: PatientFilters[K]
  ) {
    // Reset to page 1 whenever filters change so user doesn't end up on
    // a page that no longer exists.
    onChange({ ...filters, [key]: value, page: 1 });
  }

  function clearAll() {
    onChange({
      q: filters.q,
      sort_by: filters.sort_by,
      sort_dir: filters.sort_dir,
      page: 1,
      page_size: filters.page_size,
    });
  }

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="secondary" className="h-10 pl-1.5 gap-2">
          <span className="grid place-items-center size-7 rounded-full bg-[#F1F4F9] text-foreground/70">
            <Filter className="size-3.5" />
          </span>
          Filter
          {activeCount > 0 && (
            <span className="grid place-items-center min-w-5 h-5 px-1.5 rounded-full bg-primary text-white text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[340px] rounded-2xl bg-white shadow-elev border border-border p-4 animate-fade-in"
        >
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm">Filters</h3>
            <button
              className="text-xs text-primary hover:underline disabled:opacity-50"
              onClick={clearAll}
              disabled={activeCount === 0}
            >
              Clear all
            </button>
          </div>

          <Facet
            label="Status"
            current={filters.status}
            options={STATUS_OPTIONS}
            onSet={(v) => setFacet("status", v)}
          />
          <Facet
            label="Risk"
            current={filters.risk}
            options={RISK_OPTIONS}
            onSet={(v) => setFacet("risk", v)}
          />
          <Facet
            label="ASA class"
            current={filters.asa}
            options={ASA_OPTIONS.map((v) => ({ v, label: `ASA ${v}` }))}
            onSet={(v) => setFacet("asa", v)}
          />

          <FacetSection label="ICU bed needed">
            <ChoiceChip
              active={filters.icu_needed === true}
              onClick={() =>
                setFacet("icu_needed", filters.icu_needed === true ? undefined : true)
              }
            >
              Required
            </ChoiceChip>
            <ChoiceChip
              active={filters.icu_needed === false}
              onClick={() =>
                setFacet("icu_needed", filters.icu_needed === false ? undefined : false)
              }
            >
              Not required
            </ChoiceChip>
          </FacetSection>

          {physicians.length > 0 && (
            <Facet
              label="Assigned provider"
              current={filters.physician_id}
              options={physicians.map((p) => ({ v: p.id, label: p.name }))}
              onSet={(v) => setFacet("physician_id", v)}
            />
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function Facet<T extends string>({
  label,
  current,
  options,
  onSet,
}: {
  label: string;
  current: T | undefined;
  options: { v: T; label: string }[];
  onSet: (v: T | undefined) => void;
}) {
  return (
    <FacetSection label={label}>
      {options.map((o) => (
        <ChoiceChip
          key={o.v}
          active={current === o.v}
          onClick={() => onSet(current === o.v ? undefined : o.v)}
        >
          {o.label}
        </ChoiceChip>
      ))}
    </FacetSection>
  );
}

function FacetSection({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-2 border-t border-border first:border-t-0 first:pt-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
        {label}
      </p>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

function ChoiceChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "px-3 py-1 rounded-full border text-xs font-medium transition",
        active
          ? "bg-primary text-white border-primary"
          : "bg-white text-foreground border-border hover:border-primary/40"
      )}
    >
      {children}
    </button>
  );
}

function countActive(f: PatientFilters): number {
  let n = 0;
  if (f.status) n++;
  if (f.risk) n++;
  if (f.asa) n++;
  if (f.icu_needed !== undefined) n++;
  if (f.physician_id) n++;
  return n;
}
