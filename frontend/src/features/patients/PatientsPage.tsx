import { useMemo, useState } from "react";
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
import { PatientTable } from "@/features/patients/components/PatientTable";
import { PatientCardGrid } from "@/features/patients/components/PatientCardGrid";
import { patients } from "@/mocks";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export function PatientsPage() {
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    if (!q) return patients;
    return patients.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.mrn.includes(q) ||
        p.procedure.toLowerCase().includes(q)
    );
  }, [query]);

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
                onChange={(e) => setQuery(e.target.value)}
                className="bg-white"
              />
            </div>
            <Button variant="secondary" className="h-10">
              <Filter className="size-4" /> Filter
            </Button>
            <Button variant="secondary" className="h-10">
              <ArrowDownAZ className="size-4" /> Sort by
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

      {viewMode === "table" ? (
        <PatientTable data={filtered} />
      ) : (
        <PatientCardGrid data={filtered} />
      )}

      <div className="flex items-center justify-between mt-6 text-sm text-muted-foreground">
        <span>
          Showing {filtered.length} of 598
        </span>
        <div className="flex items-center gap-2">
          <Button variant="secondary" size="icon" className="size-9 rounded-full">
            <ChevronLeft className="size-3.5" />
          </Button>
          <span className="px-3 py-1 rounded-full bg-white border border-border text-xs">
            Page <strong className="text-foreground">1</strong> of 50
          </span>
          <Button size="icon" className="size-9 rounded-full">
            <ChevronRight className="size-3.5" />
          </Button>
        </div>
      </div>
    </>
  );
}
