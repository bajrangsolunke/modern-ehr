/**
 * Form-filler modal — US-FORM-4. Reads the per-type field definition
 * and renders the matching inputs. On save, submits the data and the
 * backend validates against the matching Pydantic schema (single
 * source of truth — see app/schemas/form_request.py).
 */
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form";
import { useFormRequest, useSubmitForm } from "../hooks/use-forms";
import { FORM_DEFINITIONS, type FormField as FieldDef } from "../schemas";
import { FORM_TYPE_LABEL } from "../utils";
import { cn } from "@/lib/utils";

interface Props {
  formId: string | null;
  onOpenChange: (open: boolean) => void;
}

export function FormFillerModal({ formId, onOpenChange }: Props) {
  const open = Boolean(formId);
  const { data: form, isLoading } = useFormRequest(formId ?? undefined);
  const submit = useSubmitForm();

  const [values, setValues] = useState<Record<string, unknown>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Reset state when switching forms.
  useEffect(() => {
    setValues(form?.data ?? {});
    setErrors({});
  }, [form?.id, form?.data]);

  if (!open) return null;

  const def = form ? FORM_DEFINITIONS[form.formType] : null;
  const title = form ? `${FORM_TYPE_LABEL[form.formType]} form` : "Fill form";
  const subtitle = form?.patientName ? `For ${form.patientName}` : undefined;

  const setField = (name: string, val: unknown) => {
    setValues((prev) => ({ ...prev, [name]: val }));
    if (errors[name]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[name];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    if (!def) return false;
    const next: Record<string, string> = {};
    for (const f of def.fields) {
      if (!f.required) continue;
      const v = values[f.name];
      if (
        v === undefined ||
        v === null ||
        v === "" ||
        (Array.isArray(v) && v.length === 0) ||
        (f.kind === "checkbox" && v !== true)
      ) {
        next[f.name] =
          f.kind === "checkbox"
            ? "Required — please confirm."
            : "Required.";
      }
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async () => {
    if (!form || !def) return;
    if (!validate()) return;
    await submit.mutateAsync({ id: form.id, data: values });
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={subtitle}
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!form || submit.isPending}>
            {submit.isPending && <Loader2 className="size-3.5 animate-spin" />}
            {submit.isPending ? "Submitting…" : "Submit for review"}
          </Button>
        </div>
      }
    >
      {isLoading || !form || !def ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading…
        </div>
      ) : (
        <div className="space-y-4">
          {form.notes && (
            <div className="rounded-2xl bg-surface-subtle border border-border px-3 py-2 text-xs">
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-0.5">
                Note from requester
              </div>
              <div className="text-foreground">{form.notes}</div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {def.fields.map((field) => (
              <div
                key={field.name}
                className={cn(field.fullWidth && "sm:col-span-2")}
              >
                <FieldInput
                  field={field}
                  value={values[field.name]}
                  onChange={(v) => setField(field.name, v)}
                  error={errors[field.name]}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */

function FieldInput({
  field,
  value,
  onChange,
  error,
}: {
  field: FieldDef;
  value: unknown;
  onChange: (v: unknown) => void;
  error?: string;
}) {
  if (field.kind === "checkbox") {
    return (
      <FormField label="" htmlFor={field.name} error={error} hint={field.hint}>
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            id={field.name}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            className="size-4 rounded border-border mt-0.5"
          />
          <span className="text-sm leading-snug">{field.label}</span>
        </label>
      </FormField>
    );
  }

  if (field.kind === "checkbox-group") {
    const current = (Array.isArray(value) ? value : []) as string[];
    const toggle = (v: string) => {
      onChange(
        current.includes(v) ? current.filter((x) => x !== v) : [...current, v]
      );
    };
    return (
      <FormField
        label={field.label}
        required={field.required}
        error={error}
        hint={field.hint}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {field.options?.map((opt) => (
            <label
              key={opt.value}
              className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border bg-white cursor-pointer hover:bg-surface-subtle transition"
            >
              <input
                type="checkbox"
                checked={current.includes(opt.value)}
                onChange={() => toggle(opt.value)}
                className="size-4 rounded border-border"
              />
              <span className="text-sm">{opt.label}</span>
            </label>
          ))}
        </div>
      </FormField>
    );
  }

  if (field.kind === "radio") {
    const current = (value as string | undefined) ?? "";
    return (
      <FormField
        label={field.label}
        required={field.required}
        error={error}
        hint={field.hint}
      >
        <div className="flex flex-wrap gap-1.5">
          {field.options?.map((opt) => (
            <label
              key={opt.value}
              className={cn(
                "px-3 py-1.5 rounded-full border text-sm cursor-pointer transition",
                current === opt.value
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-white border-border hover:border-foreground/30"
              )}
            >
              <input
                type="radio"
                name={field.name}
                value={opt.value}
                checked={current === opt.value}
                onChange={() => onChange(opt.value)}
                className="sr-only"
              />
              {opt.label}
            </label>
          ))}
        </div>
      </FormField>
    );
  }

  if (field.kind === "textarea") {
    return (
      <FormField
        label={field.label}
        htmlFor={field.name}
        required={field.required}
        error={error}
        hint={field.hint}
      >
        <Textarea
          id={field.name}
          rows={3}
          value={(value as string | undefined) ?? ""}
          onChange={(e) => onChange(e.target.value)}
        />
      </FormField>
    );
  }

  // text + date
  return (
    <FormField
      label={field.label}
      htmlFor={field.name}
      required={field.required}
      error={error}
      hint={field.hint}
    >
      <Input
        id={field.name}
        type={field.kind === "date" ? "date" : "text"}
        value={(value as string | undefined) ?? ""}
        onChange={(e) => onChange(e.target.value)}
      />
    </FormField>
  );
}
