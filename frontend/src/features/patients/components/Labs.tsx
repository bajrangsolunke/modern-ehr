/**
 * Recent lab results panel for the Vitals & Labs tab. Pulls structured
 * values from the labs API. Source PDFs (when results were AI-
 * extracted) are summarised once in the card header rather than
 * repeated on every row — keeps rows single-line so more results
 * fit on screen.
 *
 * The whole card is collapsible — chevron toggle in the header.
 */
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  FlaskConical,
  Loader2,
  Plus,
  Sparkles,
} from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { useLabResults } from "../hooks/use-lab-results";
import { AddLabValueModal } from "./AddLabValueModal";
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
  const [collapsed, setCollapsed] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const {
    data: labs,
    isLoading,
    isError,
    error,
    refetch,
  } = useLabResults(patientId);

  // Collapse all source PDFs into a single chip row in the header.
  // Most patients have 1-2 reports; if there are more we show the
  // first two and a "+N more" with a tooltip listing the rest.
  const sources = useMemo(() => {
    if (!labs) return [] as string[];
    const seen = new Set<string>();
    const ordered: string[] = [];
    for (const l of labs) {
      const name = l.sourceDocumentName;
      if (name && !seen.has(name)) {
        seen.add(name);
        ordered.push(name);
      }
    }
    return ordered;
  }, [labs]);

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
      <CardHeader className="pb-2">
        <div className="flex flex-row items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setCollapsed((c) => !c)}
            aria-expanded={!collapsed}
            aria-controls={`labs-body-${patientId}`}
            className="flex items-center gap-2 min-w-0 text-left rounded-lg -m-1 p-1 hover:bg-surface-subtle/60 transition flex-1"
          >
            <ChevronDown
              className={cn(
                "size-4 text-muted-foreground shrink-0 transition-transform",
                collapsed && "-rotate-90",
              )}
              aria-hidden
            />
            <CardTitle>Labs &amp; Imaging</CardTitle>
            {labs && labs.length > 0 && (
              <span className="text-xs text-muted-foreground font-normal">
                · {labs.length} result{labs.length === 1 ? "" : "s"}
              </span>
            )}
          </button>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm"
              variant="secondary"
              className="h-7 text-xs"
              onClick={() => setAddOpen(true)}
            >
              <Plus className="size-3" /> Add value
            </Button>
            <button
              type="button"
              onClick={goToDocuments}
              className="text-xs text-primary hover:underline flex items-center gap-0.5"
            >
              View all <ChevronRight className="size-3" />
            </button>
          </div>
        </div>

        {!collapsed && sources.length > 0 && (
          <SourceStrip sources={sources} />
        )}
      </CardHeader>

      {!collapsed && (
        <CardContent id={`labs-body-${patientId}`} className="pb-5">
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
              description="Upload a lab-report PDF below and use ✨ Extract with AI, or click Add value to enter a single result manually."
              action={
                <Button size="sm" onClick={() => setAddOpen(true)}>
                  <Plus className="size-3.5" /> Add value
                </Button>
              }
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
                      <td className="px-3 py-1.5 font-medium truncate max-w-[280px]">
                        {l.name}
                      </td>
                      <td className="px-3 py-1.5 tabular-nums">
                        {l.value}{" "}
                        {l.unit && (
                          <span className="text-muted-foreground text-xs">
                            {l.unit}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground tabular-nums">
                        {l.referenceRange ?? "—"}
                      </td>
                      <td className="px-3 py-1.5 text-muted-foreground whitespace-nowrap">
                        {formatDate(l.collectedAt)}
                      </td>
                      <td className="px-3 py-1.5">
                        {l.flag ? (
                          <Badge
                            size="sm"
                            className={cn(flagMap[l.flag].cls)}
                          >
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
        </CardContent>
      )}

      <AddLabValueModal
        open={addOpen}
        onOpenChange={setAddOpen}
        patientId={patientId}
      />
    </Card>
  );
}

/**
 * One-line strip under the card title summarising which PDFs the
 * extracted values came from. Shows the first two filenames inline
 * and rolls additional sources into a "+N more" with a tooltip so
 * the line never grows past one row.
 */
function SourceStrip({ sources }: { sources: string[] }) {
  const visible = sources.slice(0, 2);
  const overflow = sources.length - visible.length;
  return (
    <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-muted-foreground min-w-0">
      <Sparkles className="size-3 text-primary shrink-0" aria-hidden />
      <span className="shrink-0">Extracted from</span>
      <div className="flex items-center gap-1 min-w-0 flex-wrap">
        {visible.map((name, i) => (
          <span
            key={name}
            className="truncate max-w-[260px] rounded-full bg-primary/5 border border-primary/15 text-primary px-2 py-0.5"
            title={name}
          >
            {name}
            {i < visible.length - 1 && overflow === 0 ? "," : ""}
          </span>
        ))}
        {overflow > 0 && (
          <span
            className="rounded-full bg-surface-subtle border border-border px-2 py-0.5"
            title={sources.slice(2).join("\n")}
          >
            +{overflow} more
          </span>
        )}
      </div>
    </div>
  );
}
