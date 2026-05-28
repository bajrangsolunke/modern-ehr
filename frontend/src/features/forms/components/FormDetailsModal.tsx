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
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  HelpCircle,
  Loader2,
  Pencil,
  Printer,
  RefreshCw,
  Sparkles,
  XCircle,
} from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AiTag } from "@/components/ui/ai-tag";
import { useFormRequest, useReviewForm } from "../hooks/use-forms";
import {
  useIntakeSummary,
  useResetIntakeSummary,
} from "../hooks/use-intake-summary";
import { FORM_DEFINITIONS, type FormField } from "../schemas";
import {
  FORM_TYPE_LABEL,
  STATUS_LABEL,
  STATUS_TONE,
} from "../utils";
import type { FormRequest } from "../api/forms-api";
import { cn, formatDate } from "@/lib/utils";
import { IntakeFormPreview } from "./IntakeFormPreview";
import { FormPrintLayout } from "./FormPrintLayout";

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
    // Browser-native print → user saves as PDF. The print-only
    // <FormPrintLayout/> portaled to body renders the branded
    // multi-page document; the global @media print rules hide the
    // modal/app shell so the printer only emits that layout.
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
      {/* Body-level portal that renders the branded printable document.
          Hidden on screen via .print-only; the @media print rules in
          globals.css unhide it (and hide everything else) when the user
          triggers Download / Print. */}
      <FormPrintLayout form={form} />

      <div ref={previewRef} className="space-y-5">
        {/* Status + meta */}
        <div className="flex items-center gap-2 flex-wrap">
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

        {/* AI Summary — intake forms only, lazy on first click. Sits
            above the raw answers so providers see the at-a-glance view
            before diving into the full form. */}
        {form.formType === "intake" && form.data && (
          <IntakeAiSummary formId={form.id} />
        )}

        {/* Submitted data — intake has its own nested layout; everything
            else falls back to the generic flat-field renderer. */}
        {form.formType === "intake" ? (
          <Section title="Submitted answers">
            <IntakeFormPreview
              data={form.data as Parameters<typeof IntakeFormPreview>[0]["data"]}
            />
          </Section>
        ) : form.data ? (
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
              The form hasn&apos;t been filled out yet.
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

/* -------------------------------------------------------------------------- */
/* AI Summary panel — intake-only. Lazy: provider clicks "Summarize"          */
/* to trigger the call so we don't burn LLM tokens on every modal open.       */
/* -------------------------------------------------------------------------- */

function IntakeAiSummary({ formId }: { formId: string }) {
  const [enabled, setEnabled] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const reset = useResetIntakeSummary();
  const { data, isFetching, isError, error, refetch } = useIntakeSummary(
    formId,
    { enabled }
  );

  if (!enabled) {
    return (
      <section className="no-print rounded-2xl border border-dashed border-primary/30 bg-primary/5 px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-start gap-3 min-w-0">
            <div className="flex size-9 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
              <Sparkles className="size-4" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold flex items-center gap-2">
                AI clinical summary
                <AiTag>Beta</AiTag>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Generate a clinician-ready overview with red flags and
                follow-up questions from this intake.
              </p>
            </div>
          </div>
          <Button
            size="sm"
            className="h-8 shrink-0"
            onClick={() => setEnabled(true)}
          >
            <Sparkles className="size-3.5" /> Summarize
          </Button>
        </div>
      </section>
    );
  }

  if (isFetching && !data) {
    return (
      <section className="no-print rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="text-sm font-medium">
            Generating clinical summary…
          </span>
        </div>
      </section>
    );
  }

  if (isError) {
    return (
      <section className="no-print rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="text-sm text-danger">
            Couldn&apos;t generate summary
            {error instanceof Error ? ` — ${error.message}` : ""}
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="h-8"
            onClick={() => refetch()}
          >
            <RefreshCw className="size-3.5" /> Retry
          </Button>
        </div>
      </section>
    );
  }

  if (!data) return null;

  const confidencePct = Math.round(data.confidence * 100);

  return (
    <section className="no-print rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4 space-y-3">
      {/* Header — click anywhere to toggle collapse. Chevron rotates
          based on `collapsed`. Regenerate stays separate so it doesn't
          fire on accidental clicks. */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-controls={`ai-summary-body-${formId}`}
          className="flex items-start gap-2 min-w-0 text-left flex-1 rounded-lg -m-1 p-1 hover:bg-primary/5 transition"
        >
          <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
              AI clinical summary
              <AiTag>{data.model}</AiTag>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                · {confidencePct}% confidence
              </span>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generated {formatDate(data.generatedAt)}. AI-generated — verify
              with the patient before clinical decisions.
            </p>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground shrink-0 mt-1 transition-transform",
              collapsed && "-rotate-90"
            )}
            aria-hidden
          />
        </button>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onClick={() => {
            reset(formId);
            refetch();
          }}
        >
          <RefreshCw className="size-3" /> Regenerate
        </Button>
      </div>

      {!collapsed && (
        <div id={`ai-summary-body-${formId}`} className="space-y-3">
          <p className="text-sm leading-relaxed">{data.summary}</p>

          {data.redFlags.length > 0 && (
            <SummaryList
              title="Red flags"
              tone="danger"
              icon={<AlertTriangle className="size-3.5" />}
              items={data.redFlags}
            />
          )}

          {data.bullets.length > 0 && (
            <SummaryList
              title="Key facts"
              tone="default"
              icon={null}
              items={data.bullets}
            />
          )}

          {data.followUps.length > 0 && (
            <SummaryList
              title="Suggested follow-ups"
              tone="info"
              icon={<HelpCircle className="size-3.5" />}
              items={data.followUps}
            />
          )}
        </div>
      )}
    </section>
  );
}

function SummaryList({
  title,
  items,
  icon,
  tone,
}: {
  title: string;
  items: string[];
  icon: React.ReactNode;
  tone: "default" | "danger" | "info";
}) {
  const toneClasses =
    tone === "danger"
      ? "text-danger"
      : tone === "info"
        ? "text-primary"
        : "text-foreground";
  return (
    <div>
      <div
        className={cn(
          "text-[10px] uppercase tracking-wider font-semibold mb-1.5 inline-flex items-center gap-1",
          toneClasses
        )}
      >
        {icon}
        {title}
      </div>
      <ul className="space-y-1 text-sm">
        {items.map((it, i) => (
          <li key={i} className="flex gap-2 leading-snug">
            <span
              className={cn(
                "mt-1.5 size-1 rounded-full shrink-0",
                tone === "danger"
                  ? "bg-danger"
                  : tone === "info"
                    ? "bg-primary"
                    : "bg-muted-foreground"
              )}
            />
            <span>{it}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

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
