/**
 * Request-a-form modal — US-FORM-2. Provider picks a patient + a form
 * type (the six only), optional notes + due date. Submit creates a
 * pending FormRequest and an auto-task on the workqueue.
 */
import { useMemo, useState } from "react";
import { ChevronDown, Loader2, Search, Send } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form";
import { UserAvatar } from "@/components/ui/avatar";
import { usePatients } from "@/features/patients/hooks/use-patients";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useRequestForm } from "../hooks/use-forms";
import {
  FORM_TYPES,
  FORM_TYPE_DESCRIPTION,
  FORM_TYPE_LABEL,
} from "../utils";
import type { FormType } from "../api/forms-api";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** When opened from a patient profile, the patient is pre-selected
   *  and the picker is read-only. */
  defaultPatientId?: string;
}

export function RequestFormModal({
  open,
  onOpenChange,
  defaultPatientId,
}: Props) {
  const request = useRequestForm();

  const [patientId, setPatientId] = useState<string>(defaultPatientId ?? "");
  const [formType, setFormType] = useState<FormType>("consent");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");

  const canSubmit = Boolean(patientId) && !request.isPending;

  const onSubmit = async () => {
    if (!canSubmit) return;
    await request.mutateAsync({
      patient_id: patientId,
      form_type: formType,
      notes: notes.trim() || null,
      due_date: dueDate || null,
    });
    resetAndClose();
  };

  const resetAndClose = () => {
    if (!defaultPatientId) setPatientId("");
    setFormType("consent");
    setNotes("");
    setDueDate("");
    onOpenChange(false);
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => (o ? onOpenChange(o) : resetAndClose())}
      title="Request a form"
      description="Sends the request to the patient's chart and creates a workqueue task."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={resetAndClose}>
            Cancel
          </Button>
          <Button onClick={onSubmit} disabled={!canSubmit}>
            {request.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Send className="size-3.5" />
            )}
            {request.isPending ? "Sending…" : "Send request"}
          </Button>
        </div>
      }
    >
      <div className="space-y-5">
        <FormField label="Patient" required>
          {defaultPatientId ? (
            <div className="h-10 rounded-full bg-surface-subtle border border-border px-3 inline-flex items-center text-sm text-muted-foreground italic">
              Scoped to this patient
            </div>
          ) : (
            <PatientPicker value={patientId} onChange={setPatientId} />
          )}
        </FormField>

        <FormField label="Form type" required>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {FORM_TYPES.map((t) => (
              <FormTypeCard
                key={t}
                type={t}
                active={t === formType}
                onClick={() => setFormType(t)}
              />
            ))}
          </div>
        </FormField>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <FormField label="Due date">
            <Input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </FormField>
        </div>

        <FormField
          label="Notes"
          hint="Optional context for whoever fills the form."
        >
          <Textarea
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="e.g. Surgery scheduled next Monday, need consent before."
          />
        </FormField>
      </div>
    </Modal>
  );
}

/* -------------------------------------------------------------------------- */

function FormTypeCard({
  type,
  active,
  onClick,
}: {
  type: FormType;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "rounded-2xl border p-3 text-left transition ring-focus",
        active
          ? "border-primary bg-primary/5"
          : "border-border bg-white hover:border-foreground/30"
      )}
    >
      <div className="text-sm font-semibold">{FORM_TYPE_LABEL[type]}</div>
      <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
        {FORM_TYPE_DESCRIPTION[type]}
      </div>
    </button>
  );
}

function PatientPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const debounced = useDebouncedValue(query, 200);

  const { data: results } = usePatients({
    q: debounced || undefined,
    page: 1,
    page_size: 12,
  });

  const selected = useMemo(
    () => results?.items.find((p) => p.id === value) ?? null,
    [results, value]
  );

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 rounded-full border border-border bg-white px-3 h-10 text-left shadow-soft ring-focus"
      >
        {selected ? (
          <span className="flex items-center gap-2 min-w-0">
            <UserAvatar name={selected.name} src={selected.avatarUrl} size="sm" />
            <span className="text-sm font-medium truncate">{selected.name}</span>
            <span className="text-xs text-muted-foreground">
              MRN {selected.mrn}
            </span>
          </span>
        ) : (
          <span className="text-sm text-muted-foreground">Pick a patient…</span>
        )}
        <ChevronDown className="size-4 text-muted-foreground shrink-0" />
      </button>

      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-2xl border border-border bg-white shadow-elev p-2 animate-fade-in">
          <div className="relative">
            <Search className="size-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name or MRN…"
              className="w-full h-9 rounded-full border border-border bg-white pl-9 pr-3 text-sm ring-focus"
            />
          </div>
          <div className="max-h-64 overflow-y-auto mt-2">
            {(results?.items ?? []).length === 0 && (
              <div className="text-xs text-muted-foreground px-3 py-4 text-center">
                No matches.
              </div>
            )}
            {results?.items.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onChange(p.id);
                  setOpen(false);
                  setQuery("");
                }}
                className={cn(
                  "flex items-center gap-2 w-full px-2 py-2 rounded-xl hover:bg-surface-subtle text-left",
                  value === p.id && "bg-surface-subtle"
                )}
              >
                <UserAvatar name={p.name} src={p.avatarUrl} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{p.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    MRN {p.mrn}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
