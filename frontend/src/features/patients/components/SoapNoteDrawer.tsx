/**
 * SoapNoteDrawer — slide-in drawer for authoring or quick-editing a SOAP note.
 *
 * Mirrors the shape of the full-page `SoapNotePage`, but in a drawer surface
 * so it can be opened from contexts that shouldn't claim a full route — for
 * example, the telehealth flow where a SOAP draft is generated mid-visit.
 *
 * Required SOAP fields are managed via react-hook-form. Two pre-fill paths
 * are supported, with `prefill` winning on open transition false → true:
 *   1. `note` — an existing SoapNote (edit mode)
 *   2. `prefill` — an AI-generated draft (e.g. from telehealth)
 */
import { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import {
  SoapEditor,
  type SoapValues,
} from "@/features/notes/components/SoapEditor";
import { useForm, zodResolver, z } from "@/lib/form";
import {
  useCreateNote,
  useUpdateNote,
} from "@/features/patients/hooks/use-notes";
import type { SoapNote } from "@/types";

const schema = z
  .object({
    subjective: z.string().optional().or(z.literal("")),
    objective: z.string().optional().or(z.literal("")),
    assessment: z.string().optional().or(z.literal("")),
    plan: z.string().optional().or(z.literal("")),
  })
  .refine(
    (v) =>
      Boolean(
        (v.subjective ?? "").trim() ||
          (v.objective ?? "").trim() ||
          (v.assessment ?? "").trim() ||
          (v.plan ?? "").trim(),
      ),
    { message: "Add content to at least one section", path: ["subjective"] },
  );

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  /** Set this to edit an existing note; omit for create. */
  note?: SoapNote;
  /** Optional pre-filled draft (e.g. from telehealth SOAP generation).
   *  When provided, the four fields seed on first open; user can
   *  freely edit before saving. */
  prefill?: {
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
  } | null;
}

export function SoapNoteDrawer({
  open,
  onOpenChange,
  patientId,
  note,
  prefill,
}: Props) {
  const isEdit = Boolean(note);
  const create = useCreateNote(patientId);
  const update = useUpdateNote(patientId);

  const {
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      subjective: note?.subjective ?? "",
      objective: note?.objective ?? "",
      assessment: note?.assessment ?? "",
      plan: note?.plan ?? "",
    },
  });

  // Re-seed from an existing note when one is provided (edit mode).
  useEffect(() => {
    if (open && note) {
      reset({
        subjective: note.subjective ?? "",
        objective: note.objective ?? "",
        assessment: note.assessment ?? "",
        plan: note.plan ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, note?.id]);

  // Pre-fill from an AI-generated draft (e.g. telehealth). Wins over `note`
  // when both are present — caller should typically use one or the other.
  useEffect(() => {
    if (open && prefill) {
      reset({
        subjective: prefill.subjective,
        objective: prefill.objective,
        assessment: prefill.assessment,
        plan: prefill.plan,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, prefill]);

  const watched = watch();
  const soapValues: SoapValues = {
    subjective: watched.subjective ?? "",
    objective: watched.objective ?? "",
    assessment: watched.assessment ?? "",
    plan: watched.plan ?? "",
  };

  const hasContent = Boolean(
    soapValues.subjective.trim() ||
      soapValues.objective.trim() ||
      soapValues.assessment.trim() ||
      soapValues.plan.trim(),
  );

  const handleEditorChange = (vals: SoapValues) => {
    setValue("subjective", vals.subjective, { shouldDirty: true });
    setValue("objective", vals.objective, { shouldDirty: true });
    setValue("assessment", vals.assessment, { shouldDirty: true });
    setValue("plan", vals.plan, { shouldDirty: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      subjective: values.subjective || null,
      objective: values.objective || null,
      assessment: values.assessment || null,
      plan: values.plan || null,
    };

    if (isEdit && note) {
      await update.mutateAsync({ id: note.id, input: payload });
    } else {
      await create.mutateAsync({ patient_id: patientId, ...payload });
    }
    onOpenChange(false);
    reset();
  });

  const submitting = isSubmitting || create.isPending || update.isPending;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit SOAP note" : "New SOAP note"}
      description={
        isEdit
          ? `v${note?.version ?? 1} · ${note?.author ?? ""}`
          : prefill
          ? "Draft pre-filled — review and edit before saving."
          : "Document the encounter — at least one section is required."
      }
      size="xl"
      footer={
        <div className="flex justify-end gap-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void onSubmit()}
            disabled={submitting || !hasContent}
          >
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting
              ? "Saving…"
              : isEdit
              ? "Save changes"
              : "Save note"}
          </Button>
        </div>
      }
    >
      <SoapEditor
        values={soapValues}
        onChange={handleEditorChange}
        errors={{
          subjective: errors.subjective?.message,
        }}
      />
    </Drawer>
  );
}
