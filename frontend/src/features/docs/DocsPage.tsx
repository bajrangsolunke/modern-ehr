/**
 * Documents library page.
 * User stories US-DOCS-1..US-DOCS-6 in
 * docs/superpowers/specs/2026-05-27-workflow-user-stories.md.
 */
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  FileText,
  Files,
  Filter,
  HeartPulse,
  Image,
  Plus,
  Search,
  Shield,
  Trash2,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { SummaryTile } from "@/components/ui/summary-tile";
import { Pagination } from "@/components/ui/pagination";
import { FilterChip } from "@/components/ui/filter-chip";
import { DocumentUploadModal } from "@/features/docs/components/DocumentUploadModal";
import { DocumentDetailsModal } from "@/features/docs/components/DocumentDetailsModal";
import {
  useDeleteDocument,
  useDocuments,
} from "@/features/docs/hooks/use-documents";
import {
  CATEGORY_LABEL,
  CATEGORY_TONE,
  CATEGORY_KEYS,
  categoryLabel,
} from "@/features/docs/categories";
import { useAuthStore } from "@/stores/auth-store";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import type {
  DocCategory,
  Document,
  DocumentFilters,
} from "@/features/docs/api/docs-api";
import { cn, formatBytes, formatDate } from "@/lib/utils";

export function DocsPage() {
  const user = useAuthStore((s) => s.user);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [category, setCategory] = useState<DocCategory | undefined>();
  const [scope, setScope] = useState<"all" | "mine">("all");
  const [page, setPage] = useState(1);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [viewing, setViewing] = useState<Document | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Document | null>(null);

  const filters: DocumentFilters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      category,
      patient_id: searchParams.get("patient_id") ?? undefined,
      uploaded_by: scope === "mine" ? user?.email : undefined,
      page,
      page_size: 24,
    }),
    [debouncedQuery, category, scope, user?.email, page, searchParams]
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useDocuments(filters);
  const remove = useDeleteDocument();
  const canWrite = user?.role === "provider" || user?.role === "admin";

  const counts = useMemo(() => {
    const items = data?.items ?? [];
    return {
      total: data?.total ?? 0,
      consent: items.filter((d) => d.category === "consent").length,
      imaging: items.filter((d) => d.category === "imaging").length,
      lab: items.filter((d) => d.category === "lab").length,
    };
  }, [data]);

  const activeFilterCount =
    (category ? 1 : 0) + (scope === "mine" ? 1 : 0);

  const resetFilters = () => {
    setCategory(undefined);
    setScope("all");
  };

  return (
    <>
      <PageHeader
        title="Documents"
        right={
          <>
            <HeaderSearch
              value={query}
              onChange={setQuery}
              placeholder="Search documents…"
            />
            <FilterPopover
              activeCount={activeFilterCount}
              renderBody={(close) => (
                <FilterPopoverBody
                  category={category}
                  setCategory={(c) => {
                    setCategory(c);
                    setPage(1);
                  }}
                  scope={scope}
                  setScope={(s) => {
                    setScope(s);
                    setPage(1);
                  }}
                  showScope={Boolean(user?.email)}
                  onClear={() => {
                    resetFilters();
                    setPage(1);
                    close();
                  }}
                />
              )}
            />
            {canWrite && (
              <Button className="h-10" onClick={() => setUploadOpen(true)}>
                <Plus className="size-4" /> Upload
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3 mb-3">
        <SummaryTile
          label="Total"
          value={counts.total}
          icon={<Files />}
          tone="primary"
        />
        <SummaryTile
          label="Consent"
          value={counts.consent}
          icon={<Shield />}
          tone="warning"
        />
        <SummaryTile
          label="Imaging"
          value={counts.imaging}
          icon={<Image aria-label="" />}
          tone="info"
        />
        <SummaryTile
          label="Lab"
          value={counts.lab}
          icon={<HeartPulse />}
          tone="success"
        />
      </div>

      {isLoading && <GridSkeleton />}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load documents"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && data && (
        <>
          {data.items.length === 0 ? (
            <EmptyState canUpload={canWrite} onUpload={() => setUploadOpen(true)} />
          ) : (
            <DocumentGrid items={data.items} onOpen={setViewing} />
          )}

          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            shown={data.items.length}
            noun="document"
            onChange={setPage}
          />
        </>
      )}

      <DocumentUploadModal
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        defaultPatientId={searchParams.get("patient_id") ?? undefined}
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
        description="This permanently deletes the document from the patient's chart."
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
/* Grid + card                                                                */
/* -------------------------------------------------------------------------- */

function DocumentGrid({
  items,
  onOpen,
}: {
  items: Document[];
  onOpen: (d: Document) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {items.map((d) => (
        <DocumentCard key={d.id} doc={d} onOpen={() => onOpen(d)} />
      ))}
    </div>
  );
}

function DocumentCard({ doc, onOpen }: { doc: Document; onOpen: () => void }) {
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

        <div className="mt-3 space-y-1.5 text-xs">
          <Row label="Category">
            <Badge variant={CATEGORY_TONE[doc.category as never] ?? "neutral"} size="sm">
              {categoryLabel(doc.category)}
            </Badge>
          </Row>
          <Row label="Patient">
            <span className="font-medium truncate">
              {doc.patientName || "—"}
            </span>
          </Row>
          <Row label="Uploaded">
            <span className="text-muted-foreground">
              {formatDate(doc.createdAt)}
            </span>
          </Row>
        </div>
      </button>
    </Card>
  );
}

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right truncate">{children}</span>
    </div>
  );
}

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
      {isImage ? <Image aria-label="" /> : <FileText />}
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

/* -------------------------------------------------------------------------- */
/* States                                                                     */
/* -------------------------------------------------------------------------- */

function GridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-[140px] rounded-2xl" />
      ))}
    </div>
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
    <div className="rounded-2xl border border-dashed border-border bg-surface-subtle p-12 text-center">
      <div className="size-12 rounded-2xl bg-white grid place-items-center mx-auto mb-3 text-muted-foreground">
        <Files className="size-5" />
      </div>
      <div className="text-sm font-semibold">No documents found</div>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
        Documents you upload — consent forms, lab reports, imaging — appear
        here and live on the attached patient's chart.
      </p>
      {canUpload && (
        <Button className="mt-4" onClick={onUpload}>
          <Plus className="size-3.5" /> Upload your first document
        </Button>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header search + filter popover (consistent with Patients/Appointments)     */
/* -------------------------------------------------------------------------- */

function HeaderSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="w-52">
      <Input
        icon={<Search className="size-3.5" />}
        iconPosition="right"
        iconBg
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white"
      />
    </div>
  );
}

function FilterPopover({
  activeCount,
  renderBody,
}: {
  activeCount: number;
  renderBody: (close: () => void) => React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="secondary" className="h-10 rounded-full px-4 relative">
          <Filter className="size-4" />
          Filters
          {activeCount > 0 && (
            <span className="ml-1 inline-grid place-items-center min-w-5 h-5 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold">
              {activeCount}
            </span>
          )}
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 w-[min(92vw,420px)] rounded-2xl bg-white shadow-elev border border-border p-4 animate-fade-in"
        >
          {renderBody(() => setOpen(false))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}

function FilterPopoverBody({
  category,
  setCategory,
  scope,
  setScope,
  showScope,
  onClear,
}: {
  category: DocCategory | undefined;
  setCategory: (c: DocCategory | undefined) => void;
  scope: "all" | "mine";
  setScope: (s: "all" | "mine") => void;
  showScope: boolean;
  onClear: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">Filters</h3>
        <button
          type="button"
          onClick={onClear}
          className="text-xs text-muted-foreground hover:text-foreground"
        >
          Reset
        </button>
      </div>

      <FilterGroup label="Category">
        <FilterChip
          label="All"
          active={category === undefined}
          onClick={() => setCategory(undefined)}
        />
        {CATEGORY_KEYS.map((c) => (
          <FilterChip
            key={c}
            label={CATEGORY_LABEL[c]}
            active={category === c}
            onClick={() => setCategory(category === c ? undefined : c)}
          />
        ))}
      </FilterGroup>

      {showScope && (
        <FilterGroup label="Uploaded by">
          <FilterChip
            label="Anyone"
            active={scope === "all"}
            onClick={() => setScope("all")}
          />
          <FilterChip
            label="Me"
            active={scope === "mine"}
            onClick={() => setScope("mine")}
          />
        </FilterGroup>
      )}
    </div>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">{children}</div>
    </div>
  );
}

void Trash2;
