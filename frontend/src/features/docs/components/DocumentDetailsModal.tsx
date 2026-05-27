import { Link } from "react-router-dom";
import {
  ArrowRight,
  Download,
  FileText,
  Image,
  Loader2,
  Trash2,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useDeleteDocument,
  useDocumentPreview,
  useDownloadDocument,
} from "@/features/docs/hooks/use-documents";
import { useAuthStore } from "@/stores/auth-store";
import {
  CATEGORY_TONE,
  categoryLabel,
} from "@/features/docs/categories";
import type { Document } from "@/features/docs/api/docs-api";
import { cn, formatBytes, formatDate, formatTime } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  document: Document | null;
  /** Called when the admin/provider asks to remove. Parent confirms. */
  onDelete?: (d: Document) => void;
}

export function DocumentDetailsModal({
  open,
  onOpenChange,
  document,
  onDelete,
}: Props) {
  const user = useAuthStore((s) => s.user);
  const canWrite = user?.role === "provider" || user?.role === "admin";
  const download = useDownloadDocument();
  const remove = useDeleteDocument();
  void remove;

  if (!document) {
    return (
      <Modal
        open={open}
        onOpenChange={onOpenChange}
        title="Document"
        size="md"
      >
        <div />
      </Modal>
    );
  }

  const d = document;

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={d.name}
      description={`${categoryLabel(d.category)} · ${formatBytes(d.sizeBytes)} · ${d.mimeType}`}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="text-[11px] text-muted-foreground">
            Uploaded {formatDate(d.createdAt)} · {formatTime(d.createdAt)}
            {d.uploadedBy ? ` · by ${d.uploadedBy}` : ""}
          </div>
          <div className="flex items-center gap-2">
            {canWrite && onDelete && (
              <Button
                variant="secondary"
                className="h-9 text-danger hover:text-danger"
                onClick={() => {
                  onOpenChange(false);
                  onDelete(d);
                }}
              >
                <Trash2 className="size-3.5" /> Remove
              </Button>
            )}
            <Button
              className="h-9"
              onClick={() => download.mutate(d)}
              disabled={download.isPending}
            >
              {download.isPending ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : (
                <Download className="size-3.5" />
              )}
              Download
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 flex-wrap">
          <CategoryGlyph mime={d.mimeType} />
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={CATEGORY_TONE[d.category as never] ?? "neutral"} size="sm">
                {categoryLabel(d.category)}
              </Badge>
              <Badge variant="neutral" size="sm">
                {humanMime(d.mimeType)}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatBytes(d.sizeBytes)}
              </span>
            </div>
          </div>
        </div>

        {/* Patient block */}
        {d.patientId && (
          <Link
            to={`/patients/${d.patientId}`}
            onClick={() => onOpenChange(false)}
            className="flex items-center justify-between gap-3 rounded-2xl bg-surface-subtle px-3 py-2.5 hover:bg-surface-subtle/70 transition group"
          >
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Attached to
              </div>
              <div className="font-semibold truncate">
                {d.patientName ?? "Patient"}
              </div>
              {d.patientMrn && (
                <div className="text-xs text-muted-foreground">
                  MRN {d.patientMrn}
                </div>
              )}
            </div>
            <span className="text-xs text-primary font-semibold inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
              Open chart <ArrowRight className="size-3.5" />
            </span>
          </Link>
        )}

        {/* Preview */}
        <PreviewBody doc={d} />
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */

function PreviewBody({ doc }: { doc: Document }) {
  const isText = doc.mimeType.startsWith("text/") && doc.hasPreview;
  const isImage = doc.mimeType.startsWith("image/");
  // Pull text preview only when relevant.
  const preview = useDocumentPreview(isText ? doc.id : undefined, isText);

  if (isText) {
    return (
      <section>
        <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
          Preview
        </h4>
        <div className="rounded-2xl border border-border bg-white p-3 max-h-[260px] overflow-y-auto">
          {preview.isLoading && (
            <div className="text-xs text-muted-foreground inline-flex items-center gap-2">
              <Loader2 className="size-3 animate-spin" /> Loading preview…
            </div>
          )}
          {preview.isError && (
            <div className="text-xs text-muted-foreground">
              Couldn't load a preview — try downloading instead.
            </div>
          )}
          {preview.data && (
            <pre className="text-xs whitespace-pre-wrap font-mono leading-relaxed">
              {preview.data.text}
            </pre>
          )}
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-dashed border-border bg-surface-subtle p-6 text-center">
      <div className="size-10 rounded-2xl bg-white grid place-items-center mx-auto mb-2 text-muted-foreground">
        {isImage ? (
          <Image className="size-5" aria-label="Image" />
        ) : (
          <FileText className="size-5" />
        )}
      </div>
      <div className="text-sm font-semibold">
        No inline preview for this file type.
      </div>
      <p className="text-xs text-muted-foreground mt-1">
        Download the file to view it in its native viewer.
      </p>
    </section>
  );
}

function CategoryGlyph({ mime }: { mime: string }) {
  const isImage = mime.startsWith("image/");
  return (
    <div
      className={cn(
        "size-12 rounded-2xl grid place-items-center shrink-0",
        isImage
          ? "bg-info/10 text-info"
          : mime === "application/pdf"
          ? "bg-danger/10 text-danger"
          : "bg-primary/10 text-primary"
      )}
    >
      {isImage ? (
        <Image className="size-5" aria-label="" />
      ) : (
        <FileText className="size-5" />
      )}
    </div>
  );
}

function humanMime(mime: string): string {
  if (!mime) return "file";
  if (mime === "application/pdf") return "PDF";
  if (mime.startsWith("image/")) return mime.replace("image/", "").toUpperCase();
  if (mime.startsWith("text/")) return "TXT";
  return mime;
}
