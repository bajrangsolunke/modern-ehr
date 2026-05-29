import { PageHeader } from "@/components/layout/PageHeader";
import { DateRangeFilter, type DateRange } from "./DateRangeFilter";
import { CsvExportButton } from "./CsvExportButton";

interface CsvProps {
  filename: string;
  headers: string[];
  rows: (string | number | null | undefined)[][];
}

interface Props {
  title: string;
  subtitle?: string;
  range: DateRange;
  onRangeChange: (r: DateRange) => void;
  kpis: React.ReactNode;
  children: React.ReactNode;
  exportProps?: CsvProps;
  isLoading?: boolean;
}

export function ReportPageShell({
  title,
  subtitle,
  range,
  onRangeChange,
  kpis,
  children,
  exportProps,
}: Props) {
  return (
    <>
      <PageHeader
        title={title}
        subtitle={subtitle}
        right={
          exportProps ? (
            <CsvExportButton {...exportProps} />
          ) : undefined
        }
      />

      {/* Date range filter */}
      <div className="mb-4">
        <DateRangeFilter value={range} onChange={onRangeChange} />
      </div>

      {/* KPI row */}
      <div className="flex flex-wrap gap-3 mb-5">{kpis}</div>

      {/* Page content */}
      <div className="space-y-4">{children}</div>
    </>
  );
}
