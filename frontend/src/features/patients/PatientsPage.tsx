import { useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  LayoutGrid,
  Plus,
  Rows3,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { PatientTable } from "@/features/patients/components/PatientTable";
import { PatientCardGrid } from "@/features/patients/components/PatientCardGrid";
import { PatientDrawer } from "@/features/patients/components/PatientDrawer";
import { PatientFiltersPopover } from "@/features/patients/components/PatientFiltersPopover";
import { PatientSortPopover } from "@/features/patients/components/PatientSortPopover";
import { PatientActiveFilters } from "@/features/patients/components/PatientActiveFilters";
import { usePatients } from "@/features/patients/hooks/use-patients";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import type { PatientFilters } from "@/features/patients/api/patients-api";

const DEFAULT_FILTERS: PatientFilters = {
  page: 1,
  page_size: 20,
  sort_by: "created_at",
  sort_dir: "desc",
};

export function PatientsPage() {
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [filters, setFilters] = useState<PatientFilters>(DEFAULT_FILTERS);
  const [newDrawerOpen, setNewDrawerOpen] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = usePatients({
    ...filters,
    q: debouncedQuery || undefined,
  });

  const setPage = (p: number) => setFilters((f) => ({ ...f, page: p }));

  return (
    <>
      <PageHeader
        title="All patients view"
        right={
          <>
            <div className="w-52">
              <Input
                icon={<Search className="size-3.5" />}
                iconPosition="right"
                iconBg
                placeholder="Search…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setFilters((f) => ({ ...f, page: 1 }));
                }}
                className="bg-white"
              />
            </div>
            <PatientFiltersPopover filters={filters} onChange={setFilters} />
            <PatientSortPopover filters={filters} onChange={setFilters} />
            <div className="flex items-center bg-white border border-border rounded-full p-1 h-10 shadow-soft">
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "size-8 grid place-items-center rounded-full transition",
                  viewMode === "table"
                    ? "bg-primary-gradient text-white shadow-glow"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Table view"
              >
                <Rows3 className="size-3.5" />
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={cn(
                  "size-8 grid place-items-center rounded-full transition",
                  viewMode === "cards"
                    ? "bg-primary-gradient text-white shadow-glow"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Card view"
              >
                <LayoutGrid className="size-3.5" />
              </button>
            </div>
            <Button variant="secondary" className="h-10">
              <Download className="size-4" /> Export data
            </Button>
            <Button className="h-10" onClick={() => setNewDrawerOpen(true)}>
              <Plus className="size-4" /> New patient
            </Button>
          </>
        }
      />

      <PatientActiveFilters filters={filters} onChange={setFilters} className="mb-3" />

      {isLoading && <TableSkeleton rows={8} cols={9} />}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load patients"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && data && (
        <>
          {viewMode === "table" ? (
            <PatientTable data={data.items} />
          ) : (
            <PatientCardGrid data={data.items} />
          )}

          <div className="flex items-center justify-between mt-6 text-sm text-muted-foreground">
            <span>
              Showing {data.items.length} of {data.total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="size-9 rounded-full"
                onClick={() => setPage(Math.max(1, (filters.page ?? 1) - 1))}
                disabled={data.page <= 1}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="px-3 py-1 rounded-full bg-white border border-border text-xs">
                Page <strong className="text-foreground">{data.page}</strong> of {data.pages}
              </span>
              <Button
                size="icon"
                className="size-9 rounded-full"
                onClick={() => setPage(Math.min(data.pages, (filters.page ?? 1) + 1))}
                disabled={data.page >= data.pages}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}

      <PatientDrawer open={newDrawerOpen} onOpenChange={setNewDrawerOpen} />
    </>
  );
}
