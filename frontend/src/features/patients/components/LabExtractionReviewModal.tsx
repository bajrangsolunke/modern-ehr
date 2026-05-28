/**
 * Modal that calls the AI extraction preview endpoint, shows an editable
 * table of extracted lab rows, and lets the provider save a reviewed
 * subset with a single click.
 */
import { useEffect, useState } from "react";
import { Loader2, Sparkles, Trash2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { toast } from "@/lib/toast";
import { labsApi, type ExtractedLabRow } from "../api/labs-api";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentId: string;
  patientId: string;
  documentName: string;
  onSaved?: () => void;
}

interface EditableRow extends ExtractedLabRow {
  included: boolean;
}

const FLAG_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "", label: "Normal" },
  { value: "H", label: "H – High" },
  { value: "L", label: "L – Low" },
  { value: "C", label: "C – Critical" },
];

export function LabExtractionReviewModal({
  open,
  onOpenChange,
  documentId,
  patientId,
  documentName,
  onSaved,
}: Props) {
  const qc = useQueryClient();

  const [rows, setRows] = useState<EditableRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Fetch extraction preview when modal opens
  useEffect(() => {
    if (!open) return;
    let cancelled = false;

    setRows([]);
    setLoadError(null);
    setLoading(true);

    labsApi
      .extractPreview(documentId)
      .then((preview) => {
        if (cancelled) return;
        setRows(
          preview.results.map((r) => ({
            ...r,
            included: true,
          }))
        );
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          err instanceof Error ? err.message : "Extraction failed."
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, documentId]);

  const saveMutation = useMutation({
    mutationFn: (results: ExtractedLabRow[]) =>
      labsApi.batchCreate({
        patient_id: patientId,
        source_document_id: documentId,
        results,
      }),
    onSuccess: (saved) => {
      qc.invalidateQueries({ queryKey: ["patient", "labs"] });
      onOpenChange(false);
      onSaved?.();
      toast.success(
        `Saved ${saved.length} lab value${saved.length === 1 ? "" : "s"} from ${documentName}`
      );
    },
    onError: (err) => {
      toast.error("Couldn't save lab values", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  function updateRow(index: number, patch: Partial<EditableRow>) {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  }

  function removeRow(index: number) {
    setRows((prev) => prev.filter((_, i) => i !== index));
  }

  const includedRows = rows.filter((r) => r.included);

  function handleSave() {
    if (includedRows.length === 0) return;
    saveMutation.mutate(
      includedRows.map(({ included: _included, ...rest }) => rest)
    );
  }

  const footer = (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs text-muted-foreground">
        {includedRows.length} of {rows.length} row
        {rows.length === 1 ? "" : "s"} selected
      </span>
      <div className="flex gap-2">
        <Button
          variant="ghost"
          onClick={() => onOpenChange(false)}
          disabled={saveMutation.isPending}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={includedRows.length === 0 || saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <Sparkles className="size-3.5" />
          )}
          Save {includedRows.length} value{includedRows.length === 1 ? "" : "s"}
        </Button>
      </div>
    </div>
  );

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title="Review extracted lab values"
      description={`AI-extracted values from "${documentName}". Review, edit, or remove rows before saving.`}
      size="xl"
      footer={!loading && !loadError && rows.length > 0 ? footer : undefined}
    >
      {loading && (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
          <Loader2 className="size-6 animate-spin" />
          <p className="text-sm">
            Extracting lab values from{" "}
            <span className="font-medium text-foreground">{documentName}</span>
            &hellip;
          </p>
        </div>
      )}

      {!loading && loadError && (
        <div className="py-8 text-center text-sm text-danger">
          <p className="font-semibold">Extraction failed</p>
          <p className="text-muted-foreground mt-1">{loadError}</p>
        </div>
      )}

      {!loading && !loadError && rows.length === 0 && (
        <div className="py-10 text-center text-sm text-muted-foreground">
          No lab values could be extracted from this document.
        </div>
      )}

      {!loading && !loadError && rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate" style={{ borderSpacing: "0 4px" }}>
            <thead>
              <tr className="text-xs text-muted-foreground text-left">
                <th className="pl-2 pr-1 py-1 w-8">
                  <span className="sr-only">Include</span>
                </th>
                <th className="px-2 py-1">Test name</th>
                <th className="px-2 py-1">Value</th>
                <th className="px-2 py-1">Unit</th>
                <th className="px-2 py-1">Reference range</th>
                <th className="px-2 py-1">Flag</th>
                <th className="px-2 py-1 w-8">
                  <span className="sr-only">Remove</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, idx) => (
                <tr
                  key={idx}
                  className={
                    row.included ? "" : "opacity-40 pointer-events-none"
                  }
                >
                  {/* Include checkbox */}
                  <td className="pl-2 pr-1 py-1">
                    <input
                      type="checkbox"
                      checked={row.included}
                      className="rounded"
                      onChange={(e) =>
                        updateRow(idx, { included: e.target.checked })
                      }
                    />
                  </td>

                  {/* Name */}
                  <td className="px-2 py-1">
                    <input
                      className="w-full min-w-[120px] rounded-lg border border-border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={row.name}
                      onChange={(e) => updateRow(idx, { name: e.target.value })}
                    />
                  </td>

                  {/* Value */}
                  <td className="px-2 py-1">
                    <input
                      className="w-full min-w-[60px] rounded-lg border border-border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={row.value}
                      onChange={(e) =>
                        updateRow(idx, { value: e.target.value })
                      }
                    />
                  </td>

                  {/* Unit */}
                  <td className="px-2 py-1">
                    <input
                      className="w-full min-w-[50px] rounded-lg border border-border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={row.unit ?? ""}
                      placeholder="—"
                      onChange={(e) =>
                        updateRow(idx, {
                          unit: e.target.value || null,
                        })
                      }
                    />
                  </td>

                  {/* Reference range */}
                  <td className="px-2 py-1">
                    <input
                      className="w-full min-w-[80px] rounded-lg border border-border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={row.referenceRange ?? ""}
                      placeholder="—"
                      onChange={(e) =>
                        updateRow(idx, {
                          referenceRange: e.target.value || null,
                        })
                      }
                    />
                  </td>

                  {/* Flag */}
                  <td className="px-2 py-1">
                    <select
                      className="rounded-lg border border-border bg-white px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                      value={row.flag ?? ""}
                      onChange={(e) =>
                        updateRow(idx, {
                          flag: (e.target.value as "H" | "L" | "C") || null,
                        })
                      }
                    >
                      {FLAG_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>
                  </td>

                  {/* Remove */}
                  <td className="px-2 py-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-full hover:bg-rose-50 text-danger"
                      aria-label="Remove row"
                      onClick={() => removeRow(idx)}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!loading && !loadError && rows.length > 0 && (
        <p className="mt-3 text-[11px] text-muted-foreground flex items-center gap-1">
          <Sparkles className="size-3 shrink-0" />
          AI-extracted values. Always verify against the source document before saving.
        </p>
      )}

      {/* AI attribution badge */}
      {!loading && !loadError && rows.length > 0 && (
        <div className="mt-2">
          <Badge variant="neutral" size="sm">
            <Sparkles className="size-2.5" /> AI-assisted extraction
          </Badge>
        </div>
      )}
    </Modal>
  );
}
