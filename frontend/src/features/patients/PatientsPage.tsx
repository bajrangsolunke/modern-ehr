import { useState } from "react";
import {
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
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
import { usePatients } from "@/features/patients/hooks/use-patients";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export function PatientsPage() {
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch, isFetching } = usePatients({
    q: query || undefined,
    page,
    page_size: 20,
  });

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
                  setPage(1);
                }}
                className="bg-white"
              />
            </div>
            <Button variant="secondary" className="h-10 pl-1.5 gap-2">
              <span className="grid place-items-center size-7 rounded-full bg-[#F1F4F9] text-foreground/70">
                <Filter className="size-3.5" />
              </span>
              Filter
            </Button>
            <Button variant="secondary" className="h-10 pl-1.5 gap-2">
              <span className="grid place-items-center size-7 rounded-full bg-[#F1F4F9] text-foreground/70">
                <ArrowDownAZ className="size-3.5" />
              </span>
              Sort by
            </Button>
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
            <Button className="h-10">
              <Plus className="size-4" /> New patient
            </Button>
          </>
        }
      />

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
                onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={data.page >= data.pages}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
