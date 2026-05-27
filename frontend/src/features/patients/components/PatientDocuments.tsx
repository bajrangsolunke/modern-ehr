/**
 * Patient-scoped documents tab — same upload/preview/delete flows as the
 * global DocsPage, but pre-bound to one patient's chart.
 * User story US-DOCS-6 (docs/superpowers/specs/2026-05-27-workflow-user-stories.md).
 */
import { useMemo, useState } from "react";
import {
  FileText,
  Files,
  Image as ImageIcon,
  LayoutGrid,
  List as ListIcon,
  Plus,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { FilterChip } from "@/components/ui/filter-chip";
import { SortableTh, TABLE_ROW_BG } from "@/components/ui/sortable-th";
import { DocumentUploadModal } from "@/features/docs/components/DocumentUploadModal";
import { DocumentDetailsModal } from "@/features/docs/components/DocumentDetailsModal";
import {
  useDeleteDocument,
  usePatientDocuments,
} from "@/features/docs/hooks/use-documents";
import {
  CATEGORY_TONE,
  categoryLabel,
} from "@/features/docs/categories";
import { useAuthStore } from "@/stores/auth-store";
import type { Document } from "@/features/docs/api/docs-api";
import { cn, formatBytes, formatDate } from "@/lib/utils";

type ViewMode = "list" | "cards";

interface Props {
  patientId: string;
}

export function PatientDocuments({ patientId }: Props) {
  const user = useAuthStore((s) => s.user);
  const canWrite = user?.role === "provider" || user?.role === "admin";
  const { data, isLoading, isError, error, refetch, isFetching } =
    usePatientDocuments(patientId);
  const remove = useDeleteDocument();

  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewing, setViewing] = useState<Document | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("list");

  const docs = data ?? [];

  const categoriesPresent = useMemo(() => {
    const seen = new Map<string, number>();
    for (const d of docs) seen.set(d.category, (seen.get(d.category) ?? 0) + 1);
    return Array.from(seen.entries());
  }, [docs]);

  const visible = useMemo(
    () =>
      activeCategory
        ? docs.filter((d) => d.category === activeCategory)
        : docs,
    [docs, activeCategory]
  );

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold">Documents</h2>
          <p className="text-xs text-muted-foreground">
            {docs.length === 0
              ? "Nothing on file yet."
              : `${docs.length} on file · consent, labs, imaging, and more.`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ViewToggle mode={view} onChange={setView} />
          {canWrite && (
            <Button className="h-9" onClick={() => setUploadOpen(true)}>
              <Plus className="size-3.5" /> Upload
            </Button>
          )}
        </div>
      </div>

      {categoriesPresent.length > 1 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <FilterChip
            label={`All · ${docs.length}`}
            active={activeCategory === null}
            onClick={() => setActiveCategory(null)}
          />
          {categoriesPresent.map(([cat, n]) => (
            <FilterChip
              key={cat}
              label={`${categoryLabel(cat)} · ${n}`}
              active={activeCategory === cat}
              onClick={() =>
                setActiveCategory(activeCategory === cat ? null : cat)
              }
            />
          ))}
        </div>
      )}

      {isLoading && (view === "list" ? <ListSkeleton /> : <GridSkeleton />)}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load documents"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && (
        <>
          {visible.length === 0 ? (
            <EmptyState
              canUpload={canWrite}
              onUpload={() => setUploadOpen(true)}
            />
          ) : view === "list" ? (
            <DocumentList items={visible} onOpen={setViewing} />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {visible.map((d) => (
                <DocumentCard key={d.id} doc={d} onOpen={() => setViewing(d)} />
              ))}
            </div>
          )}
        </>
      )}

      <DocumentUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultPatientId={patientId}
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
        title={pendingDelete ? `Remove ${pendingDelete.name}?` : "Remove document?"}
        description="This permanently deletes the document from this patient's chart."
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
/* List view                                                                  */
/* -------------------------------------------------------------------------- */

function DocumentList({
  items,
  onOpen,
}: {
  items: Document[];
  onOpen: (d: Document) => void;
}) {
  return (
    <Card className="overflow-hidden p-3 sm:p-4">
      <div className="overflow-x-auto">
        <table
          className="w-full text-sm border-separate"
          style={{ borderSpacing: "0 6px" }}
        >
          <thead>
            <tr className="text-xs text-muted-foreground text-left">
              <SortableTh first>Document</SortableTh>
              <SortableTh>Category</SortableTh>
              <SortableTh>Uploaded by</SortableTh>
              <SortableTh last>Uploaded</SortableTh>
            </tr>
          </thead>
          <tbody>
            {items.map((d) => (
              <tr
                key={d.id}
                className="hover:[&_td]:bg-[#EEF2F8] transition group cursor-pointer"
                onClick={() => onOpen(d)}
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
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {humanMime(d.mimeType)} · {formatBytes(d.sizeBytes)}
                      </div>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2" style={{ background: TABLE_ROW_BG }}>
                  <Badge
                    variant={CATEGORY_TONE[d.category as never] ?? "neutral"}
                    size="sm"
                  >
                    {categoryLabel(d.category)}
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
                  className="px-4 py-2 text-foreground/80 tabular-nums last:rounded-r-full text-right"
                  style={{ background: TABLE_ROW_BG }}
                >
                  {formatDate(d.createdAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Card view                                                                  */
/* -------------------------------------------------------------------------- */

function DocumentCard({
  doc,
  onOpen,
}: {
  doc: Document;
  onOpen: () => void;
}) {
  return (
    <Card className="card-hover">
      <button
        type="button"
        onClick={onOpen}
        className="block w-full text-left p-4 ring-focus rounded-2xl"
      >
        <div className="flex items-start gap-3">
          <Glyph mime={doc.mimeType} />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold truncate">{doc.name}</div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {humanMime(doc.mimeType)} · {formatBytes(doc.sizeBytes)}
            </div>
          </div>
        </div>

        <div className="mt-3 flex items-center justify-between gap-2">
          <Badge
            variant={CATEGORY_TONE[doc.category as never] ?? "neutral"}
            size="sm"
          >
            {categoryLabel(doc.category)}
          </Badge>
          <span className="text-[11px] text-muted-foreground">
            {formatDate(doc.createdAt)}
          </span>
        </div>
      </button>
    </Card>
  );
}

/* -------------------------------------------------------------------------- */
/* Shared bits                                                                */
/* -------------------------------------------------------------------------- */

function Glyph({ mime }: { mime: string }) {
  const isImage = mime.startsWith("image/");
  return (
    <div
      className={cn(
        "size-10 rounded-xl grid place-items-center shrink-0 [&_svg]:size-4",
        isImage
          ? "bg-info/10 text-info"
          : mime === "application/pdf"
          ? "bg-danger/10 text-danger"
          : "bg-primary/10 text-primary"
      )}
    >
      {isImage ? <ImageIcon aria-label="" /> : <FileText />}
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

function ViewToggle({
  mode,
  onChange,
}: {
  mode: ViewMode;
  onChange: (m: ViewMode) => void;
}) {
  return (
    <div className="bg-[#F1F4F9] rounded-full p-1 flex items-center gap-1">
      <ViewToggleButton
        active={mode === "list"}
        onClick={() => onChange("list")}
        label="List view"
        icon={<ListIcon className="size-3.5" />}
      />
      <ViewToggleButton
        active={mode === "cards"}
        onClick={() => onChange("cards")}
        label="Card view"
        icon={<LayoutGrid className="size-3.5" />}
      />
    </div>
  );
}

function ViewToggleButton({
  active,
  onClick,
  label,
  icon,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-pressed={active}
      className={cn(
        "size-8 grid place-items-center rounded-full transition",
        active
          ? "bg-primary-gradient text-white shadow-glow"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {icon}
    </button>
  );
}

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <Skeleton key={i} className="h-[120px] rounded-2xl" />
      ))}
    </div>
  );
}

function ListSkeleton() {
  return (
    <Card className="overflow-hidden">
      <div className="divide-y divide-border">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-[60px] rounded-none" />
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
        <Files className="size-5" />
      </div>
      <div className="text-sm font-semibold">No documents on file</div>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
        Upload consent forms, lab reports, imaging, or any clinical PDF or
        text — they'll live here as part of this patient's chart.
      </p>
      {canUpload && (
        <Button className="mt-4" onClick={onUpload}>
          <Plus className="size-3.5" /> Upload document
        </Button>
      )}
    </div>
  );
}
