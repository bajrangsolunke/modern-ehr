import * as Popover from "@radix-ui/react-popover";
import { ArrowDownAZ, ArrowDown, ArrowUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type {
  PatientFilters,
  PatientSortBy,
  PatientSortDir,
} from "@/features/patients/api/patients-api";

interface Props {
  filters: PatientFilters;
  onChange: (next: PatientFilters) => void;
}

const COLUMNS: { v: PatientSortBy; label: string }[] = [
  { v: "created_at", label: "Most recent (added)" },
  { v: "first_name", label: "First name" },
  { v: "mrn", label: "MRN" },
  { v: "procedure_date", label: "Procedure date" },
  { v: "risk_score", label: "Risk level" },
];

export function PatientSortPopover({ filters, onChange }: Props) {
  const currentBy: PatientSortBy = filters.sort_by ?? "created_at";
  const currentDir: PatientSortDir = filters.sort_dir ?? "desc";

  const set = (by: PatientSortBy, dir: PatientSortDir) =>
    onChange({ ...filters, sort_by: by, sort_dir: dir, page: 1 });

  const isDefault = currentBy === "created_at" && currentDir === "desc";

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button variant="secondary" className="h-10 pl-1.5 gap-2">
          <span className="grid place-items-center size-7 rounded-full bg-[#F1F4F9] text-foreground/70">
            <ArrowDownAZ className="size-3.5" />
          </span>
          Sort by
          {!isDefault && (
            <span className="text-[11px] font-medium text-primary">
              {labelOf(currentBy)} {currentDir === "asc" ? "↑" : "↓"}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[280px] rounded-2xl bg-white shadow-elev border border-border p-2 animate-fade-in"
        >
          {COLUMNS.map((c) => {
            const activeAsc = currentBy === c.v && currentDir === "asc";
            const activeDesc = currentBy === c.v && currentDir === "desc";
            return (
              <div
                key={c.v}
                className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-xl hover:bg-secondary"
              >
                <span className="text-sm font-medium">{c.label}</span>
                <div className="flex items-center gap-1">
                  <DirButton
                    active={activeAsc}
                    onClick={() => set(c.v, "asc")}
                    aria-label={`Sort ${c.label} ascending`}
                  >
                    <ArrowUp className="size-3.5" />
                  </DirButton>
                  <DirButton
                    active={activeDesc}
                    onClick={() => set(c.v, "desc")}
                    aria-label={`Sort ${c.label} descending`}
                  >
                    <ArrowDown className="size-3.5" />
                  </DirButton>
                </div>
              </div>
            );
          })}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function DirButton({
  active,
  ...props
}: { active: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cn(
        "size-7 grid place-items-center rounded-full transition border",
        active
          ? "bg-primary text-white border-primary"
          : "bg-white text-foreground/70 border-border hover:border-primary/40"
      )}
    />
  );
}

function labelOf(v: PatientSortBy): string {
  return COLUMNS.find((c) => c.v === v)?.label ?? v;
}
