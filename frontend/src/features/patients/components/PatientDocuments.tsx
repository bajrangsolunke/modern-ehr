/**
 * Patient-scoped document list — mounted in the Documents tab of the
 * patient profile. Pulls from `usePatientDocuments(patientId)` and
 * reuses `DocumentUploadModal` (locked to this patient) for the upload
 * flow. Click a row to open `DocumentDetailsModal` for preview/download.
 */
import { useState } from "react";
import { FileText, FileUp, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Empty } from "@/components/ui/empty";
import { ErrorBanner } from "@/components/ui/error-banner";
import { DocumentUploadModal } from "@/features/docs/components/DocumentUploadModal";
import { DocumentDetailsModal } from "@/features/docs/components/DocumentDetailsModal";
import { usePatientDocuments } from "@/features/docs/hooks/use-documents";
import type { Document } from "@/features/docs/api/docs-api";
import { CATEGORY_LABEL } from "@/features/docs/categories";
import { formatBytes, formatDate } from "@/lib/utils";

interface Props {
  patientId: string;
}

export function PatientDocuments({ patientId }: Props) {
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewing, setViewing] = useState<Document | null>(null);
  const { data: documents, isLoading, isError, error, refetch } =
    usePatientDocuments(patientId);

  return (
    <>
      <Card>
        <CardContent className="p-5 space-y-4">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="text-base font-semibold">Documents</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Uploaded files and PDFs for this patient — consent, labs,
                imaging, discharge summaries, etc.
              </p>
            </div>
            <Button size="sm" onClick={() => setUploadOpen(true)}>
              <FileUp className="size-3.5" /> Upload document
            </Button>
          </div>

          {isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
              <Loader2 className="size-4 animate-spin" />
              Loading documents…
            </div>
          )}

          {isError && !isLoading && (
            <ErrorBanner
              title="Couldn't load documents"
              message={error instanceof Error ? error.message : "Please try again."}
              onRetry={() => refetch()}
            />
          )}

          {!isLoading && !isError && documents && documents.length === 0 && (
            <Empty
              icon={<FileText className="size-6" />}
              title="No documents yet"
              description="Upload PDFs or images for this patient — consents, lab reports, discharge summaries, etc."
              action={
                <Button size="sm" onClick={() => setUploadOpen(true)}>
                  <FileUp className="size-3.5" /> Upload first document
                </Button>
              }
            />
          )}

          {!isLoading && !isError && documents && documents.length > 0 && (
            <ul className="space-y-2">
              {documents.map((d) => (
                <li key={d.id}>
                  <button
                    type="button"
                    onClick={() => setViewing(d)}
                    className="w-full flex items-center justify-between gap-3 rounded-2xl bg-surface-subtle hover:bg-surface-subtle/70 px-4 py-3 text-left transition"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold truncate">
                          {d.name}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 truncate">
                          {formatDate(d.createdAt)} · {formatBytes(d.sizeBytes)}
                          {d.uploadedBy ? ` · by ${d.uploadedBy}` : ""}
                        </div>
                      </div>
                    </div>
                    <Badge variant="default" size="sm" className="shrink-0">
                      {CATEGORY_LABEL[d.category as keyof typeof CATEGORY_LABEL] ?? d.category}
                    </Badge>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <DocumentUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultPatientId={patientId}
      />

      <DocumentDetailsModal
        open={Boolean(viewing)}
        onOpenChange={(open) => !open && setViewing(null)}
        document={viewing}
      />
    </>
  );
}
