/**
 * Forms workflow — US-FORM-1..8
 * (docs/superpowers/specs/2026-05-27-workflow-user-stories.md).
 */
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  Clock,
  FileText,
  Filter,
  Pencil,
  Plus,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import * as Popover from "@radix-ui/react-popover";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ErrorBanner } from "@/components/ui/error-banner";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { FilterChip } from "@/components/ui/filter-chip";
import { SortableTh, TABLE_ROW_BG } from "@/components/ui/sortable-th";
import { SummaryTile } from "@/components/ui/summary-tile";
import { DEFAULT_PAGE_SIZE, Pagination } from "@/components/ui/pagination";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useAuthStore } from "@/stores/auth-store";
import {
  useDeleteFormRequest,
  useFormRequests,
} from "./hooks/use-forms";
import { RequestFormModal } from "./components/RequestFormModal";
import { FormFillerModal } from "./components/FormFillerModal";
import { FormDetailsModal } from "./components/FormDetailsModal";
import {
  FORM_TYPES,
  FORM_TYPE_LABEL,
  STATUSES,
  STATUS_LABEL,
  STATUS_TONE,
} from "./utils";
import type { FormRequest, FormStatus, FormType } from "./api/forms-api";
import { cn, formatDate } from "@/lib/utils";

/** Intake + consent open the full-page editor; the simpler form types
 *  use the modal filler. */
function usesPageEditor(formType: FormType): boolean {
  return formType === "intake" || formType === "consent";
}

export function FormsPage() {
  const user = useAuthStore((s) => s.user);
  const canRequest = user?.role === "provider" || user?.role === "admin";
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scopedPatientId = searchParams.get("patient_id") ?? undefined;

  const [query, setQuery] = useState("");
  const debouncedQuery = useDebouncedValue(query, 300);
  const [status, setStatus] = useState<FormStatus | undefined>();
  const [formType, setFormType] = useState<FormType | undefined>();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);

  const [requestOpen, setRequestOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [fillingId, setFillingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FormRequest | null>(null);

  const filters = useMemo(
    () => ({
      q: debouncedQuery || undefined,
      status,
      form_type: formType,
      patient_id: scopedPatientId,
      page,
      page_size: pageSize,
    }),
    [debouncedQuery, status, formType, scopedPatientId, page, pageSize]
  );

  const { data, isLoading, isError, error, refetch, isFetching } =
    useFormRequests(filters);
  const remove = useDeleteFormRequest();

  // Stat tiles need totals across statuses — fetch a slim summary by
  // running a separate query. Use page_size=1 to minimize payload.
  const pendingQ = useFormRequests({
    status: "pending",
    patient_id: scopedPatientId,
    page: 1,
    page_size: 1,
  });
  const submittedQ = useFormRequests({
    status: "submitted",
    patient_id: scopedPatientId,
    page: 1,
    page_size: 1,
  });
  const completedQ = useFormRequests({
    status: "completed",
    patient_id: scopedPatientId,
    page: 1,
    page_size: 1,
  });
  const deniedQ = useFormRequests({
    status: "denied",
    patient_id: scopedPatientId,
    page: 1,
    page_size: 1,
  });

  const activeFilterCount = (formType ? 1 : 0) + (status ? 1 : 0);

  const fillForm = (f: FormRequest) => {
    if (usesPageEditor(f.formType)) {
      navigate(`/forms/${f.id}/edit`);
    } else {
      setFillingId(f.id);
    }
  };

  const onRowClick = (f: FormRequest) => {
    if (f.status === "pending") {
      fillForm(f);
    } else {
      setViewingId(f.id);
    }
  };

  return (
    <>
      <PageHeader
        title="Forms"
        right={
          <>
            <HeaderSearch value={query} onChange={setQuery} />
            <StatusDropdown value={status} onChange={setStatus} />
            <FilterPopover
              activeCount={activeFilterCount}
              renderBody={(close) => (
                <FilterPopoverBody
                  formType={formType}
                  setFormType={(t) => {
                    setFormType(t);
                    setPage(1);
                  }}
                  onClear={() => {
                    setFormType(undefined);
                    close();
                  }}
                />
              )}
            />
            {canRequest && (
              <Button className="h-10" onClick={() => setRequestOpen(true)}>
                <Plus className="size-4" /> Request form
              </Button>
            )}
          </>
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 lg:gap-3 mb-3">
        <SummaryTile
          label="Pending"
          value={pendingQ.data?.total ?? 0}
          icon={<Clock />}
          tone="info"
        />
        <SummaryTile
          label="Submitted"
          value={submittedQ.data?.total ?? 0}
          icon={<ClipboardList />}
          tone="warning"
        />
        <SummaryTile
          label="Completed"
          value={completedQ.data?.total ?? 0}
          icon={<CheckCircle2 />}
          tone="success"
        />
        <SummaryTile
          label="Denied"
          value={deniedQ.data?.total ?? 0}
          icon={<XCircle />}
          tone="danger"
        />
      </div>

      {isLoading && <TableSkeleton rows={8} cols={7} />}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load forms"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && data && (
        <>
          {data.items.length === 0 ? (
            <EmptyState
              canRequest={canRequest}
              onRequest={() => setRequestOpen(true)}
            />
          ) : (
            <FormsTable
              items={data.items}
              onRowClick={onRowClick}
              onFill={fillForm}
              onView={(f) => setViewingId(f.id)}
              onDelete={(f) => setPendingDelete(f)}
              canModify={canRequest}
            />
          )}

          <Pagination
            page={data.page}
            pages={data.pages}
            total={data.total}
            shown={data.items.length}
            noun="form"
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setPage(1);
            }}
            onChange={setPage}
          />
        </>
      )}

      <RequestFormModal
        open={requestOpen}
        onOpenChange={setRequestOpen}
        defaultPatientId={scopedPatientId}
      />
      <FormFillerModal
        formId={fillingId}
        onOpenChange={(open) => !open && setFillingId(null)}
      />
      <FormDetailsModal
        formId={viewingId}
        onOpenChange={(open) => !open && setViewingId(null)}
        onFill={(f) => {
          setViewingId(null);
          fillForm(f);
        }}
        canModify={canRequest}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => !open && setPendingDelete(null)}
        title={
          pendingDelete
            ? `Remove this ${FORM_TYPE_LABEL[pendingDelete.formType]} request?`
            : "Remove form?"
        }
        description="The form request will be deleted. The audit log keeps a record. The linked task survives."
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
/* Table                                                                      */
/* -------------------------------------------------------------------------- */

function FormsTable({
  items,
  onRowClick,
  onFill,
  onView,
  onDelete,
  canModify,
}: {
  items: FormRequest[];
  onRowClick: (f: FormRequest) => void;
  onFill: (f: FormRequest) => void;
  onView: (f: FormRequest) => void;
  onDelete: (f: FormRequest) => void;
  canModify: boolean;
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
              <SortableTh first>Form</SortableTh>
              <SortableTh>Patient</SortableTh>
              <SortableTh>Requested by</SortableTh>
              <SortableTh>Requested on</SortableTh>
              <SortableTh>Due</SortableTh>
              <SortableTh>Status</SortableTh>
              <SortableTh last>Action</SortableTh>
            </tr>
          </thead>
          <tbody>
            {items.map((f) => (
              <tr
                key={f.id}
                className="hover:[&_td]:bg-[#EEF2F8] transition group cursor-pointer"
                onClick={() => onRowClick(f)}
              >
                <td
                  className="px-4 py-2 first:rounded-l-full"
                  style={{ background: TABLE_ROW_BG }}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <FormGlyph />
                    <div className="font-semibold hover:text-primary transition truncate">
                      {FORM_TYPE_LABEL[f.formType]} form
                    </div>
                  </div>
                </td>
                <td className="px-4 py-2" style={{ background: TABLE_ROW_BG }}>
                  <div className="min-w-0">
                    <div className="font-medium truncate">
                      {f.patientName ?? "—"}
                    </div>
                    {f.patientMrn && (
                      <div className="text-[11px] text-muted-foreground">
                        MRN {f.patientMrn}
                      </div>
                    )}
                  </div>
                </td>
                <td
                  className="px-4 py-2 text-foreground/80"
                  style={{ background: TABLE_ROW_BG }}
                >
                  {f.requestedByName ?? (
                    <span className="text-muted-foreground italic">—</span>
                  )}
                </td>
                <td
                  className="px-4 py-2 text-foreground/80 tabular-nums"
                  style={{ background: TABLE_ROW_BG }}
                >
                  {formatDate(f.createdAt)}
                </td>
                <td
                  className="px-4 py-2 text-foreground/80 tabular-nums"
                  style={{ background: TABLE_ROW_BG }}
                >
                  {f.dueDate ? formatDate(f.dueDate) : "—"}
                </td>
                <td className="px-4 py-2" style={{ background: TABLE_ROW_BG }}>
                  <Badge className={cn("border-transparent", STATUS_TONE[f.status])}>
                    {STATUS_LABEL[f.status]}
                  </Badge>
                </td>
                <td
                  className="px-4 py-2 last:rounded-r-full"
                  style={{ background: TABLE_ROW_BG }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-end gap-1">
                    {f.status === "pending" ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 rounded-full bg-white hover:bg-white/80 text-primary font-semibold"
                        onClick={() => onFill(f)}
                      >
                        <Pencil className="size-3" /> Fill out
                      </Button>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-3 rounded-full bg-white hover:bg-white/80 text-foreground/70"
                        onClick={() => onView(f)}
                      >
                        View
                      </Button>
                    )}
                    {canModify && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 rounded-full bg-white hover:bg-rose-50 text-danger"
                        aria-label="Delete form request"
                        onClick={() => onDelete(f)}
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
  );
}

function FormGlyph() {
  return (
    <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
      <FileText className="size-4" />
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Header controls                                                            */
/* -------------------------------------------------------------------------- */

function HeaderSearch({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="w-52">
      <Input
        icon={<Search className="size-3.5" />}
        iconPosition="right"
        iconBg
        placeholder="Search forms…"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bg-white"
      />
    </div>
  );
}

function StatusDropdown({
  value,
  onChange,
}: {
  value: FormStatus | undefined;
  onChange: (s: FormStatus | undefined) => void;
}) {
  const [open, setOpen] = useState(false);
  const label = value ? STATUS_LABEL[value] : "All Status";
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <Button variant="secondary" className="h-10 rounded-full px-3 gap-2">
          {label}
          <ChevronDown className="size-3.5 opacity-60" />
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={6}
          className="z-50 min-w-[180px] rounded-2xl bg-white shadow-elev border border-border p-1 animate-fade-in"
        >
          <button
            type="button"
            onClick={() => {
              onChange(undefined);
              setOpen(false);
            }}
            className={cn(
              "w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-secondary transition",
              value === undefined && "font-semibold"
            )}
          >
            All Status
          </button>
          {STATUSES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              className={cn(
                "w-full text-left px-3 py-2 text-sm rounded-xl hover:bg-secondary transition",
                value === s && "font-semibold"
              )}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
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
  formType,
  setFormType,
  onClear,
}: {
  formType: FormType | undefined;
  setFormType: (t: FormType | undefined) => void;
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
      <div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5">
          Form type
        </div>
        <div className="flex flex-wrap gap-1.5">
          <FilterChip
            label="Any"
            active={formType === undefined}
            onClick={() => setFormType(undefined)}
          />
          {FORM_TYPES.map((t) => (
            <FilterChip
              key={t}
              label={FORM_TYPE_LABEL[t]}
              active={formType === t}
              onClick={() => setFormType(formType === t ? undefined : t)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* States                                                                     */
/* -------------------------------------------------------------------------- */

function EmptyState({
  canRequest,
  onRequest,
}: {
  canRequest: boolean;
  onRequest: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-subtle p-12 text-center">
      <div className="size-12 rounded-2xl bg-white grid place-items-center mx-auto mb-3 text-muted-foreground">
        <FileText className="size-5" />
      </div>
      <div className="text-sm font-semibold">No form requests yet</div>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
        Request a form from a patient — consent, intake, ROI, insurance,
        discharge, or referral — and it'll show up here for fill and review.
      </p>
      {canRequest && (
        <Button className="mt-4" onClick={onRequest}>
          <Plus className="size-3.5" /> Request your first form
        </Button>
      )}
    </div>
  );
}
