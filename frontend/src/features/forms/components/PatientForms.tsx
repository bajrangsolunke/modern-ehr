/**
 * Patient-scoped forms panel — drops into the patient profile in
 * place of the old uploaded-documents tab. Same workflow as the
 * global Forms page (request → fill → review → preview) but filtered
 * to one patient and without page chrome.
 */
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Pencil, Plus, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ErrorBanner } from "@/components/ui/error-banner";
import { Skeleton } from "@/components/ui/skeleton";
import { SortableTh, TABLE_ROW_BG } from "@/components/ui/sortable-th";
import {
  useDeleteFormRequest,
  useFormRequests,
} from "../hooks/use-forms";
import { useAuthStore } from "@/stores/auth-store";
import { RequestFormModal } from "./RequestFormModal";
import { FormFillerModal } from "./FormFillerModal";
import { FormDetailsModal } from "./FormDetailsModal";
import {
  FORM_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from "../utils";
import type { FormRequest } from "../api/forms-api";
import { cn, formatDate } from "@/lib/utils";

interface Props {
  patientId: string;
}

export function PatientForms({ patientId }: Props) {
  const user = useAuthStore((s) => s.user);
  const canRequest = user?.role === "provider" || user?.role === "admin";
  const navigate = useNavigate();

  const { data, isLoading, isError, error, refetch, isFetching } =
    useFormRequests({ patient_id: patientId, page: 1, page_size: 50 });
  const remove = useDeleteFormRequest();

  const [requestOpen, setRequestOpen] = useState(false);
  const [viewingId, setViewingId] = useState<string | null>(null);
  const [fillingId, setFillingId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<FormRequest | null>(null);

  const forms = data?.items ?? [];

  const fillForm = (f: FormRequest) => {
    if (f.formType === "intake" || f.formType === "consent") {
      navigate(`/forms/${f.id}/edit`);
    } else {
      setFillingId(f.id);
    }
  };

  const onRowClick = (f: FormRequest) => {
    if (f.status === "pending") fillForm(f);
    else setViewingId(f.id);
  };

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="min-w-0">
          <h2 className="text-base font-bold">Forms</h2>
          <p className="text-xs text-muted-foreground">
            {forms.length === 0
              ? "No forms requested yet."
              : `${forms.length} on file · request new ones from the patient.`}
          </p>
        </div>
        {canRequest && (
          <Button className="h-9" onClick={() => setRequestOpen(true)}>
            <Plus className="size-3.5" /> Request form
          </Button>
        )}
      </div>

      {isLoading && <ListSkeleton />}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load forms"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && (
        <>
          {forms.length === 0 ? (
            <EmptyState
              canRequest={canRequest}
              onRequest={() => setRequestOpen(true)}
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
                      <SortableTh first>Form</SortableTh>
                      <SortableTh>Requested by</SortableTh>
                      <SortableTh>Requested on</SortableTh>
                      <SortableTh>Due</SortableTh>
                      <SortableTh>Status</SortableTh>
                      <SortableTh last>Action</SortableTh>
                    </tr>
                  </thead>
                  <tbody>
                    {forms.map((f) => (
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
                            <Glyph />
                            <div className="font-semibold hover:text-primary transition truncate">
                              {FORM_TYPE_LABEL[f.formType]} form
                            </div>
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
                                onClick={() => fillForm(f)}
                              >
                                <Pencil className="size-3" /> Fill out
                              </Button>
                            ) : (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 px-3 rounded-full bg-white hover:bg-white/80 text-foreground/70"
                                onClick={() => setViewingId(f.id)}
                              >
                                View
                              </Button>
                            )}
                            {canRequest && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="size-7 rounded-full bg-white hover:bg-rose-50 text-danger"
                                aria-label="Delete form request"
                                onClick={() => setPendingDelete(f)}
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

      <RequestFormModal
        open={requestOpen}
        onOpenChange={setRequestOpen}
        defaultPatientId={patientId}
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
        description="The form request will be deleted. The audit log keeps a record."
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

function Glyph() {
  return (
    <div className="size-9 rounded-xl bg-primary/10 text-primary grid place-items-center shrink-0">
      <FileText className="size-4" />
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
  canRequest,
  onRequest,
}: {
  canRequest: boolean;
  onRequest: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-subtle p-10 text-center">
      <div className="size-12 rounded-2xl bg-white grid place-items-center mx-auto mb-3 text-muted-foreground">
        <FileText className="size-5" />
      </div>
      <div className="text-sm font-semibold">No forms on file</div>
      <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
        Request a consent, intake, ROI, insurance, discharge, or referral form
        from this patient. A workqueue task is created automatically.
      </p>
      {canRequest && (
        <Button className="mt-4" onClick={onRequest}>
          <Plus className="size-3.5" /> Request a form
        </Button>
      )}
    </div>
  );
}
