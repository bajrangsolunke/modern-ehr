/**
 * Patient-scoped lab reports panel. Lives in the Vitals & Labs tab on
 * the patient profile. Lab reports are uploaded as `Document` rows
 * with category="lab" and shown back as a tap-to-preview list — same
 * pill-row table as Patients/Tasks/Forms for visual consistency.
 */
import { useMemo, useState } from "react";
import { FileText, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTh, TABLE_ROW_BG } from "@/components/ui/sortable-th";
import { DocumentUploadModal } from "@/features/docs/components/DocumentUploadModal";
import { DocumentDetailsModal } from "@/features/docs/components/DocumentDetailsModal";
import {
  useDeleteDocument,
  usePatientDocuments,
} from "@/features/docs/hooks/use-documents";
import { useAuthStore } from "@/stores/auth-store";
import type { Document } from "@/features/docs/api/docs-api";
import { cn, formatBytes, formatDate } from "@/lib/utils";

interface Props {
  patientId: string;
}

export function LabReports({ patientId }: Props) {
  const user = useAuthStore((s) => s.user);
  const canWrite = user?.role === "provider" || user?.role === "admin";

  const { data, isLoading, isError, error, refetch, isFetching } =
    usePatientDocuments(patientId);
  const remove = useDeleteDocument();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewing, setViewing] = useState<Document | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);

  // Show only lab-category documents — other categories live in the
  // Forms surface or chat attachments.
  const labReports = useMemo(
    () => (data ?? []).filter((d) => d.category === "lab"),
    [data]
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold">Lab reports</h2>
          <p className="text-xs text-muted-foreground">
            {labReports.length === 0
              ? "Upload lab PDFs or images so they're visible on the chart."
              : `${labReports.length} on file · viewable inside the patient's chart.`}
          </p>
        </div>
        {canWrite && (
          <Button className="h-9" onClick={() => setUploadOpen(true)}>
            <Plus className="size-3.5" /> Upload lab report
          </Button>
        )}
      </div>

      {isLoading && <ListSkeleton />}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load lab reports"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && (
        <>
          {labReports.length === 0 ? (
            <EmptyState
              canUpload={canWrite}
              onUpload={() => setUploadOpen(true)}
            />
          ) : (
            <Card className="overflow-hidden p-3 sm:p-4">
              <div className="overflow-x-auto">
                <table
                  className="w-full text-sm border-separate"
                  style={{ borderSpacing: "0 6px" }}
                >
                  <thead>
                    <tr className="text-xs text-muted-foreground text-left">
                      <SortableTh first>Report</SortableTh>
                      <SortableTh>Type</SortableTh>
                      <SortableTh>Uploaded by</SortableTh>
                      <SortableTh>Uploaded</SortableTh>
                      <SortableTh last>Action</SortableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {labReports.map((d) => (
                      <tr
                        key={d.id}
                        className="hover:[&_td]:bg-[#EEF2F8] transition group cursor-pointer"
                        onClick={() => setViewing(d)}
                      >
                        <td
                          className="px-4 py-2 first:rounded-l-full"
                          style={{ background: TABLE_ROW_BG }}
                        >
                          <div className="flex items-center gap-3 min-w-0">
                            <Glyph mime={d.mimeType} />
                            <div className="min-w-0">
                              <div className="font-semibold hover:text-primary transition truncate">
                                {d.name}
                              </div>
                              <div className="text-[11px] text-muted-foreground">
                                {formatBytes(d.sizeBytes)}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td
                          className="px-4 py-2"
                          style={{ background: TABLE_ROW_BG }}
                        >
                          <Badge variant="info" size="sm">
                            Lab
                          </Badge>
                        </td>
                        <td
                          className="px-4 py-2 text-foreground/80"
                          style={{ background: TABLE_ROW_BG }}
                        >
                          {d.uploadedBy ?? (
                            <span className="text-muted-foreground italic">—</span>
                          )}
                        </td>
                        <td
                          className="px-4 py-2 text-foreground/80 tabular-nums"
                          style={{ background: TABLE_ROW_BG }}
                        >
                          {formatDate(d.createdAt)}
                        </td>
                        <td
                          className="px-4 py-2 last:rounded-r-full"
                          style={{ background: TABLE_ROW_BG }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-3 rounded-full bg-white hover:bg-white/80 text-foreground/70"
                              onClick={() => setViewing(d)}
                            >
                              View
                            </Button>
                            {canWrite && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-full bg-white hover:bg-rose-50 text-danger"
                                aria-label="Delete lab report"
                                onClick={() => setPendingDelete(d)}
                              >
                                <Trash2 className="size-3" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
        </>
      )}

      <DocumentUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultPatientId={patientId}
        lockedCategory="lab"
        title="Upload lab report"
        description="Attach a lab PDF or image to this patient's chart. Up to 25 MB."
      />

      <DocumentDetailsModal
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        document={viewing}
        onDelete={canWrite ? setPendingDelete : undefined}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={pendingDelete ? `Remove ${pendingDelete.name}?` : "Remove lab report?"}
        description="This permanently deletes the lab report from this patient's chart."
        confirmLabel="Remove"
        destructive
        busy={remove.isPending}
        onConfirm={async () => {
          if (!pendingDelete) return;
          await remove.mutateAsync(pendingDelete.id);
          setPendingDelete(null);
        }}
      />
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Glyph({ mime }: { mime: string }) {
  const isImage = mime.startsWith("image/");
  return (
    <div
      className={cn(
        "size-9 rounded-xl grid place-items-center shrink-0 [&_svg]:size-4",
        isImage ? "bg-info/10 text-info" : "bg-danger/10 text-danger"
      )}
    >
      {isImage ? <ImageIcon aria-label="" /> : <FileText />}
    </div>
  );
}

function ListSkeleton() {
  return (
    <Card className="overflow-hidden p-3 sm:p-4">
      <div className="space-y-1.5">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-12 rounded-2xl" />
        ))}
      </div>
    </Card>
  );
}

function EmptyState({
  canUpload,
  onUpload,
}: {
  canUpload: boolean;
  onUpload: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-subtle p-10 text-center">
      <div className="size-12 rounded-2xl bg-white grid place-items-center mx-auto mb-3 text-muted-foreground">
        <FileText className="size-5" />
      </div>
      <div className="text-sm font-semibold">No lab reports on file</div>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
        Upload a lab PDF or image — patients see it on their chart and
        providers can preview it without leaving the patient profile.
      </p>
      {canUpload && (
        <Button className="mt-4" onClick={onUpload}>
          <Plus className="size-3.5" /> Upload lab report
        </Button>
      )}
    </div>
  );
}
