/**
 * Recent lab results panel for the Vitals & Labs tab. Pulls structured
 * values from the labs API. A small "Imaging studies" footer counts
 * documents categorized as imaging — the actual files live in the
 * Documents tab.
 */
import { useMemo } from "react";
import { ChevronRight, FlaskConical, Loader2, ScanLine } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useLabResults } from "../hooks/use-lab-results";
import { usePatientDocuments } from "@/features/docs/hooks/use-documents";
import { cn, formatDate } from "@/lib/utils";

const flagMap = {
  H: { label: "High", cls: "bg-danger/10 text-danger" },
  L: { label: "Low", cls: "bg-info/10 text-info" },
  C: { label: "Critical", cls: "bg-rose-100 text-rose-700" },
} as const;

interface Props {
  patientId: string;
}

export function Labs({ patientId }: Props) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const {
    data: labs,
    isLoading,
    isError,
    error,
    refetch,
  } = useLabResults(patientId);
  const { data: documents } = usePatientDocuments(patientId);

  const imagingCount = useMemo(
    () =>
      (documents ?? []).filter((d) => d.category === "imaging").length,
    [documents],
  );

  const goToDocuments = () => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", "documents");
    navigate(
      { pathname: `/patients/${patientId}`, search: next.toString() },
      { replace: false },
    );
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle>Labs &amp; Imaging</CardTitle>
        <button
          type="button"
          onClick={goToDocuments}
          className="text-xs text-primary hover:underline flex items-center gap-0.5"
        >
          View all <ChevronRight className="size-3" />
        </button>
      </CardHeader>
      <CardContent className="pb-5 space-y-4">
        {isLoading && (
          <div className="flex items-center gap-2 justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading lab results…
          </div>
        )}

        {isError && !isLoading && (
          <ErrorBanner
            title="Couldn't load labs"
            message={
              error instanceof Error ? error.message : "Please try again."
            }
            onRetry={() => refetch()}
          />
        )}

        {!isLoading && !isError && labs && labs.length === 0 && (
          <Empty
            icon={<FlaskConical className="size-6" />}
            title="No lab results yet"
            description="Lab values will appear here as they're recorded for this patient."
          />
        )}

        {!isLoading && !isError && labs && labs.length > 0 && (
          <div className="overflow-hidden rounded-xl border border-border">
            <table className="w-full text-sm">
              <thead className="bg-surface-subtle text-xs text-muted-foreground">
                <tr className="text-left">
                  <th className="px-3 py-2 font-medium">Test</th>
                  <th className="px-3 py-2 font-medium">Value</th>
                  <th className="px-3 py-2 font-medium">Range</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Flag</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {labs.map((l) => (
                  <tr key={l.id} className="hover:bg-surface-subtle/70">
                    <td className="px-3 py-2 font-medium">{l.name}</td>
                    <td className="px-3 py-2">
                      {l.value}{" "}
                      {l.unit && (
                        <span className="text-muted-foreground text-xs">
                          {l.unit}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {l.referenceRange ?? "—"}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDate(l.collectedAt)}
                    </td>
                    <td className="px-3 py-2">
                      {l.flag ? (
                        <Badge size="sm" className={cn(flagMap[l.flag].cls)}>
                          {flagMap[l.flag].label}
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm">
                          Normal
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Imaging-studies footer: actual imaging files live in the
            Documents tab; this is just a quick "you have N on file" so
            the panel earns its "Labs & Imaging" title. */}
        <button
          type="button"
          onClick={goToDocuments}
          className="w-full flex items-center justify-between gap-3 rounded-xl bg-surface-subtle hover:bg-surface-subtle/70 px-4 py-3 transition text-left"
        >
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-lg bg-sky-100 text-sky-700 grid place-items-center">
              <ScanLine className="size-4" />
            </div>
            <div>
              <div className="text-sm font-semibold">Imaging studies</div>
              <div className="text-xs text-muted-foreground">
                {imagingCount === 0
                  ? "No imaging on file"
                  : `${imagingCount} image${imagingCount === 1 ? "" : "s"} on file`}
              </div>
            </div>
          </div>
          <span className="text-xs text-primary inline-flex items-center gap-0.5">
            View <ChevronRight className="size-3" />
          </span>
        </button>
      </CardContent>
    </Card>
  );
}
