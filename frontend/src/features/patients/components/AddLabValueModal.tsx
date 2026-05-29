/**
 * Manual entry of a single lab value. For verbal reports, point-of-care
 * testing, or backfill when no PDF exists. Persists via labsApi.batchCreate
 * with a one-row payload (the backend accepts batches; no separate
 * single-create method on the frontend yet).
 */
import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { labsApi } from "../api/labs-api";
import type { ExtractedLabRow } from "../api/labs-api";
import { toast } from "@/lib/toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
}

type FlagInput = "" | "H" | "L" | "C";

interface FormState {
  name: string;
  value: string;
  unit: string;
  referenceRange: string;
  flag: FlagInput;
}

const EMPTY: FormState = {
  name: "",
  value: "",
  unit: "",
  referenceRange: "",
  flag: "",
};

export function AddLabValueModal({ open, onOpenChange, patientId }: Props) {
  const qc = useQueryClient();
  const [form, setForm] = useState<FormState>(EMPTY);

  const save = useMutation({
    mutationFn: async () => {
      const row: ExtractedLabRow = {
        name: form.name.trim(),
        value: form.value.trim(),
        unit: form.unit.trim() || null,
        referenceRange: form.referenceRange.trim() || null,
        flag: form.flag === "" ? null : form.flag,
      };
      return labsApi.batchCreate({
        patient_id: patientId,
        results: [row],
        // No source_document_id — manual entry, not extracted from a PDF.
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["patient", "labs", patientId] });
      toast.success("Lab value saved");
      setForm(EMPTY);
      onOpenChange(false);
    },
    onError: (err) => {
      toast.error("Couldn't save lab value", {
        description: err instanceof Error ? err.message : undefined,
      });
    },
  });

  const canSave = form.name.trim() !== "" && form.value.trim() !== "";

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSave || save.isPending) return;
    save.mutate();
  };

  return (
    <Modal
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) setForm(EMPTY);
      }}
      title="Add lab value"
      description="Enter a single result manually — for verbal reports, point-of-care testing, or backfill."
      size="md"
      footer={
        <div className="flex justify-end gap-2 w-full">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={save.isPending}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            form="add-lab-form"
            disabled={!canSave || save.isPending}
          >
            {save.isPending && <Loader2 className="size-3.5 animate-spin" />}
            Save
          </Button>
        </div>
      }
    >
      <form id="add-lab-form" onSubmit={handleSubmit} className="space-y-3">
        <FormField label="Test name" htmlFor="lab-name" required>
          <Input
            id="lab-name"
            placeholder="e.g. HbA1c, Hemoglobin, INR"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            autoFocus
            required
          />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Value" htmlFor="lab-value" required>
            <Input
              id="lab-value"
              placeholder="e.g. 6.5"
              value={form.value}
              onChange={(e) => setForm({ ...form, value: e.target.value })}
              required
            />
          </FormField>
          <FormField label="Unit" htmlFor="lab-unit">
            <Input
              id="lab-unit"
              placeholder="e.g. % or mg/dL"
              value={form.unit}
              onChange={(e) => setForm({ ...form, unit: e.target.value })}
            />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Reference range" htmlFor="lab-range">
            <Input
              id="lab-range"
              placeholder="e.g. 4.0-5.6"
              value={form.referenceRange}
              onChange={(e) =>
                setForm({ ...form, referenceRange: e.target.value })
              }
            />
          </FormField>
          <FormField label="Flag" htmlFor="lab-flag">
            <select
              id="lab-flag"
              value={form.flag}
              onChange={(e) =>
                setForm({ ...form, flag: e.target.value as FlagInput })
              }
              className="h-10 w-full rounded-full border border-border bg-white px-3 text-sm ring-focus"
            >
              <option value="">Normal</option>
              <option value="H">High</option>
              <option value="L">Low</option>
              <option value="C">Critical</option>
            </select>
          </FormField>
        </div>
      </form>
    </Modal>
  );
}
