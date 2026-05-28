import { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form";
import { Badge } from "@/components/ui/badge";
import { useFormDetail, useSubmitForm } from "@/features/tasks/hooks/use-tasks";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

interface Props {
  formId: string | null;
  onClose: () => void;
}

const FORM_LABEL: Record<string, string> = {
  consent: "Consent form",
  intake: "Intake form",
  roi: "Release of information",
  insurance: "Insurance details",
  discharge: "Discharge form",
  referral: "Referral form",
};

interface Field {
  key: string;
  label: string;
  type: "text" | "textarea" | "date" | "email" | "tel";
  required?: boolean;
  hint?: string;
  placeholder?: string;
}

const SCHEMAS: Record<string, Field[]> = {
  consent: [
    { key: "full_name", label: "Full legal name", type: "text", required: true },
    { key: "dob", label: "Date of birth", type: "date", required: true },
    {
      key: "consents_to_treatment",
      label: "I consent to the proposed treatment",
      type: "text",
      hint: 'Type "yes" to consent',
      required: true,
    },
    { key: "signature", label: "Signature (type your name)", type: "text", required: true },
  ],
  intake: [
    { key: "full_name", label: "Full name", type: "text", required: true },
    { key: "dob", label: "Date of birth", type: "date", required: true },
    { key: "email", label: "Email", type: "email" },
    { key: "phone", label: "Phone", type: "tel" },
    { key: "primary_complaint", label: "What brings you in?", type: "textarea", required: true },
    { key: "medications", label: "Current medications", type: "textarea" },
    { key: "allergies", label: "Allergies", type: "textarea" },
    { key: "medical_history", label: "Past medical history", type: "textarea" },
  ],
  roi: [
    { key: "full_name", label: "Full name", type: "text", required: true },
    { key: "dob", label: "Date of birth", type: "date", required: true },
    { key: "release_to", label: "Release records to", type: "text", required: true },
    { key: "purpose", label: "Purpose of release", type: "textarea", required: true },
    { key: "signature", label: "Signature", type: "text", required: true },
  ],
  insurance: [
    { key: "carrier", label: "Insurance carrier", type: "text", required: true },
    { key: "member_id", label: "Member ID", type: "text", required: true },
    { key: "group_number", label: "Group number", type: "text" },
    { key: "policy_holder", label: "Policy holder name", type: "text", required: true },
    { key: "phone", label: "Carrier phone", type: "tel" },
  ],
  discharge: [
    { key: "discharge_to", label: "Discharge to", type: "text", required: true },
    { key: "follow_up", label: "Follow-up plan", type: "textarea", required: true },
    { key: "concerns", label: "Any concerns?", type: "textarea" },
    { key: "signature", label: "Signature", type: "text", required: true },
  ],
  referral: [
    { key: "referring_to", label: "Specialist / clinic", type: "text", required: true },
    { key: "reason", label: "Reason for referral", type: "textarea", required: true },
    { key: "preferred_contact", label: "Preferred contact", type: "text" },
  ],
};

function defaultSchema(formType: string): Field[] {
  return [
    {
      key: "notes",
      label: `${FORM_LABEL[formType] ?? formType} details`,
      type: "textarea",
      required: true,
      placeholder: "Enter the requested information",
    },
  ];
}

export function FormFillModal({ formId, onClose }: Props) {
  const open = formId !== null;
  const { data: detail, isLoading } = useFormDetail(formId);
  const submit = useSubmitForm();
  const [values, setValues] = useState<Record<string, string>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset form state when the modal opens with a new form.
  useEffect(() => {
    if (!open) return;
    if (detail?.data && typeof detail.data === "object") {
      const init: Record<string, string> = {};
      for (const [k, v] of Object.entries(detail.data)) {
        init[k] = typeof v === "string" ? v : v == null ? "" : String(v);
      }
      setValues(init);
    } else {
      setValues({});
    }
    setErrors({});
  }, [open, detail]);

  if (!open) return null;

  const fields = detail
    ? SCHEMAS[detail.form_type] ?? defaultSchema(detail.form_type)
    : [];
  const readOnly = detail?.status === "completed" || detail?.status === "denied";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    const nextErrors: Record<string, string> = {};
    for (const f of fields) {
      if (f.required && !values[f.key]?.trim()) {
        nextErrors[f.key] = "Required";
      }
    }
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }
    submit.mutate(
      { id: detail.id, data: values },
      {
        onSuccess: () => onClose(),
      }
    );
  };

  return (
    <Dialog.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/40 animate-fade-in" />
        <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 rounded-3xl bg-white shadow-elev border border-border max-h-[90vh] flex flex-col">
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4 border-b border-border">
            <div className="min-w-0">
              <Dialog.Title className="text-lg font-semibold tracking-tight">
                {detail
                  ? FORM_LABEL[detail.form_type] ?? detail.form_type
                  : "Loading form…"}
              </Dialog.Title>
              {detail && (
                <Dialog.Description className="text-sm text-muted-foreground mt-1 flex items-center gap-2 flex-wrap">
                  <Badge
                    variant={
                      detail.status === "completed"
                        ? "success"
                        : detail.status === "submitted"
                          ? "info"
                          : detail.status === "denied"
                            ? "danger"
                            : "warning"
                    }
                    size="sm"
                  >
                    {detail.status}
                  </Badge>
                  {detail.requested_by && <span>Requested by {detail.requested_by}</span>}
                  {detail.due_date && <span>· Due {formatDate(detail.due_date)}</span>}
                </Dialog.Description>
              )}
            </div>
            <Dialog.Close asChild>
              <button
                aria-label="Close"
                className="size-9 rounded-full bg-secondary hover:bg-secondary/80 grid place-items-center text-muted-foreground hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            </Dialog.Close>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-5">
            {isLoading || !detail ? (
              <div className="grid place-items-center py-12">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : (
              <form id="form-fill" onSubmit={handleSubmit} className="space-y-4" noValidate>
                {detail.notes && (
                  <div className="rounded-2xl bg-primary/5 border border-primary/20 px-4 py-3 text-sm text-foreground">
                    <span className="font-semibold">Note from your care team: </span>
                    {detail.notes}
                  </div>
                )}
                {fields.map((f) => (
                  <FormField
                    key={f.key}
                    label={f.label}
                    htmlFor={f.key}
                    required={f.required}
                    hint={f.hint}
                    error={errors[f.key]}
                  >
                    {f.type === "textarea" ? (
                      <Textarea
                        id={f.key}
                        value={values[f.key] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [f.key]: e.target.value }))
                        }
                        placeholder={f.placeholder}
                        disabled={readOnly}
                        rows={3}
                      />
                    ) : (
                      <Input
                        id={f.key}
                        type={f.type}
                        value={values[f.key] ?? ""}
                        onChange={(e) =>
                          setValues((v) => ({ ...v, [f.key]: e.target.value }))
                        }
                        placeholder={f.placeholder}
                        disabled={readOnly}
                      />
                    )}
                  </FormField>
                ))}
              </form>
            )}
          </div>

          <div className={cn(
            "flex items-center justify-end gap-2 px-6 py-4 border-t border-border",
            readOnly && "bg-secondary/40 rounded-b-3xl"
          )}>
            <Button variant="ghost" onClick={onClose} disabled={submit.isPending}>
              {readOnly ? "Close" : "Cancel"}
            </Button>
            {!readOnly && detail && (
              <Button
                type="submit"
                form="form-fill"
                disabled={submit.isPending}
              >
                {submit.isPending && <Loader2 className="animate-spin" />}
                {submit.isPending
                  ? "Submitting…"
                  : detail.status === "submitted"
                    ? "Resubmit"
                    : "Submit form"}
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
