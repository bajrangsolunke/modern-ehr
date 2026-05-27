/**
 * Form details + preview — US-FORM-5 (review) + US-FORM-6 (preview + download).
 *
 * Read-only view of the submitted form. Provider/admin can mark it
 * Completed (approve) or Denied (with a reason). Completed forms get
 * a "Download" button that triggers the browser's print dialog so the
 * user can save as PDF — no server-side PDF dependency.
 */
import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  CheckCircle2,
  Loader2,
  Pencil,
  Printer,
  XCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useFormRequest, useReviewForm } from "../hooks/use-forms";
import { FORM_DEFINITIONS, type FormField } from "../schemas";
import {
  FORM_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from "../utils";
import type { FormRequest } from "../api/forms-api";
import { cn, formatDate } from "@/lib/utils";

interface Props {
  formId: string | null;
  onOpenChange: (open: boolean) => void;
  /** Re-open the filler from the details view (only valid when
   *  status is pending/submitted). */
  onFill: (f: FormRequest) => void;
  /** Hide write actions when the viewer can't modify. */
  canModify: boolean;
}

export function FormDetailsModal({
  formId,
  onOpenChange,
  onFill,
  canModify,
}: Props) {
  const open = Boolean(formId);
  const { data: form, isLoading } = useFormRequest(formId ?? undefined);
  const review = useReviewForm();
  const previewRef = useRef<HTMLDivElement | null>(null);

  const [denying, setDenying] = useState(false);
  const [denyReason, setDenyReason] = useState("");

  if (!open) return null;
  if (isLoading || !form) {
    return (
      <Modal open={open} onOpenChange={onOpenChange} title="Form" size="lg">
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading…
        </div>
      </Modal>
    );
  }

  const def = FORM_DEFINITIONS[form.formType];

  const approve = async () => {
    await review.mutateAsync({ id: form.id, decision: "completed" });
    onOpenChange(false);
  };

  const deny = async () => {
    if (!denyReason.trim()) return;
    await review.mutateAsync({
      id: form.id,
      decision: "denied",
      review_notes: denyReason.trim(),
    });
    setDenying(false);
    setDenyReason("");
    onOpenChange(false);
  };

  const handlePrint = () => {
    // Browser-native print → user saves as PDF. The @media print
    // styles below hide all chrome and render only the preview block.
    window.print();
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={`${FORM_TYPE_LABEL[form.formType]} form`}
      description={form.patientName ? `For ${form.patientName}` : undefined}
      size="xl"
      footer={
        <ReviewFooter
          form={form}
          canModify={canModify}
          denying={denying}
          denyReason={denyReason}
          setDenyReason={setDenyReason}
          onStartDeny={() => setDenying(true)}
          onCancelDeny={() => {
            setDenying(false);
            setDenyReason("");
          }}
          onApprove={approve}
          onDeny={deny}
          onFill={() => onFill(form)}
          onPrint={handlePrint}
          busy={review.isPending}
        />
      }
    >
      <div ref={previewRef} className="space-y-5 form-preview">
        {/* Status + meta */}
        <div className="flex items-center gap-2 flex-wrap no-print">
          <Badge className={cn("border-transparent", STATUS_TONE[form.status])}>
            {STATUS_LABEL[form.status]}
          </Badge>
          {form.reviewNotes && (
            <span className="text-xs text-muted-foreground">
              · Review note: {form.reviewNotes}
            </span>
          )}
        </div>

        {/* Patient + meta header — visible in both screen + print */}
        <div className="rounded-2xl bg-surface-subtle px-4 py-3 print:bg-white print:border print:border-border">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <Meta label="Patient" value={form.patientName ?? "—"} />
            {form.patientMrn && <Meta label="MRN" value={form.patientMrn} />}
            <Meta label="Form" value={`${FORM_TYPE_LABEL[form.formType]} form`} />
            <Meta
              label="Requested by"
              value={form.requestedByName ?? "—"}
            />
            <Meta label="Requested on" value={formatDate(form.createdAt)} />
            {form.dueDate && (
              <Meta label="Due" value={formatDate(form.dueDate)} />
            )}
            {form.submittedByName && (
              <Meta label="Submitted by" value={form.submittedByName} />
            )}
            {form.submittedAt && (
              <Meta label="Submitted on" value={formatDate(form.submittedAt)} />
            )}
            {form.reviewedByName && (
              <Meta label="Reviewed by" value={form.reviewedByName} />
            )}
            {form.reviewedAt && (
              <Meta label="Reviewed on" value={formatDate(form.reviewedAt)} />
            )}
          </div>
        </div>

        {form.notes && (
          <Section title="Note from requester">
            <p className="text-sm whitespace-pre-wrap">{form.notes}</p>
          </Section>
        )}

        {/* Submitted data */}
        {form.data ? (
          <Section title="Submitted answers">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {def.fields.map((field) => (
                <div
                  key={field.name}
                  className={cn(field.fullWidth && "sm:col-span-2")}
                >
                  <AnswerRow field={field} value={form.data?.[field.name]} />
                </div>
              ))}
            </div>
          </Section>
        ) : (
          <Section title="Submitted answers">
            <p className="text-sm text-muted-foreground italic">
              The form hasn't been filled out yet.
            </p>
          </Section>
        )}

        {/* Linked patient deep-link — hidden on print */}
        {form.patientId && (
          <Link
            to={`/patients/${form.patientId}?tab=documents`}
            onClick={() => onOpenChange(false)}
            className="no-print flex items-center justify-between gap-3 rounded-2xl bg-surface-subtle px-3 py-2.5 hover:bg-surface-subtle/70 transition group"
          >
            <div className="min-w-0">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                Patient
              </div>
              <div className="font-semibold truncate">
                {form.patientName ?? "Patient"}
              </div>
            </div>
            <span className="text-xs text-primary font-semibold inline-flex items-center gap-1 group-hover:gap-1.5 transition-all">
              Open chart <ArrowRight className="size-3.5" />
            </span>
          </Link>
        )}
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */

function ReviewFooter({
  form,
  canModify,
  denying,
  denyReason,
  setDenyReason,
  onStartDeny,
  onCancelDeny,
  onApprove,
  onDeny,
  onFill,
  onPrint,
  busy,
}: {
  form: FormRequest;
  canModify: boolean;
  denying: boolean;
  denyReason: string;
  setDenyReason: (v: string) => void;
  onStartDeny: () => void;
  onCancelDeny: () => void;
  onApprove: () => void;
  onDeny: () => void;
  onFill: () => void;
  onPrint: () => void;
  busy: boolean;
}) {
  if (denying) {
    return (
      <div className="w-full">
        <Textarea
          rows={2}
          autoFocus
          value={denyReason}
          onChange={(e) => setDenyReason(e.target.value)}
          placeholder="Reason for denial (visible on the audit trail)…"
          className="mb-2"
        />
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onCancelDeny} disabled={busy}>
            Back
          </Button>
          <Button
            onClick={onDeny}
            disabled={!denyReason.trim() || busy}
            className="bg-danger hover:bg-danger/90"
          >
            {busy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <XCircle className="size-3.5" />
            )}
            Mark Denied
          </Button>
        </div>
      </div>
    );
  }

  // Footer for a SUBMITTED form (awaiting review)
  if (form.status === "submitted" && canModify) {
    return (
      <div className="flex items-center justify-end gap-2 flex-wrap">
        <Button
          variant="secondary"
          className="h-9 text-danger hover:text-danger"
          onClick={onStartDeny}
        >
          <XCircle className="size-3.5" /> Deny
        </Button>
        <Button
          className="h-9 bg-success hover:bg-success/90"
          onClick={onApprove}
          disabled={busy}
        >
          {busy ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <CheckCircle2 className="size-3.5" />
          )}
          Mark Completed
        </Button>
      </div>
    );
  }

  // Footer for COMPLETED / DENIED forms — preview + print
  if (form.status === "completed" || form.status === "denied") {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button variant="secondary" className="h-9" onClick={onPrint}>
          <Printer className="size-3.5" /> Download / Print
        </Button>
      </div>
    );
  }

  // Footer for PENDING — allow fill (provider helping the patient).
  if (form.status === "pending") {
    return (
      <div className="flex items-center justify-end gap-2">
        <Button className="h-9" onClick={onFill}>
          <Pencil className="size-3.5" /> Fill out
        </Button>
      </div>
    );
  }

  return null;
}

/* -------------------------------------------------------------------------- */

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
        {title}
      </h4>
      {children}
    </section>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {label}
      </div>
      <div className="text-sm font-medium truncate">{value}</div>
    </div>
  );
}

function AnswerRow({
  field,
  value,
}: {
  field: FormField;
  value: unknown;
}) {
  return (
    <div className="rounded-2xl bg-white border border-border px-3 py-2 print:border-border">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        {field.label}
      </div>
      <div className="text-sm mt-0.5 whitespace-pre-wrap break-words">
        {renderValue(field, value)}
      </div>
    </div>
  );
}

function renderValue(field: FormField, value: unknown): React.ReactNode {
  if (value === undefined || value === null || value === "") {
    return <span className="text-muted-foreground italic">—</span>;
  }
  if (field.kind === "checkbox") {
    return value === true ? "Yes" : "No";
  }
  if (field.kind === "checkbox-group" && Array.isArray(value)) {
    const labels = (value as string[]).map((v) => {
      const opt = field.options?.find((o) => o.value === v);
      return opt?.label ?? v;
    });
    return labels.length ? labels.join(", ") : <span className="italic">—</span>;
  }
  if (field.kind === "radio") {
    const opt = field.options?.find((o) => o.value === value);
    return opt?.label ?? String(value);
  }
  if (field.kind === "date" && typeof value === "string") {
    return formatDate(value);
  }
  return String(value);
}
