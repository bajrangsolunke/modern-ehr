import { Loader2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form";
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
          (v.plan ?? "").trim()
      ),
    { message: "Add content to at least one section", path: ["subjective"] }
  );

type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  /** Set to edit an existing note; omit for create. */
  note?: SoapNote;
}

export function SoapNoteDrawer({ open, onOpenChange, patientId, note }: Props) {
  const isEdit = Boolean(note);
  const create = useCreateNote(patientId);
  const update = useUpdateNote(patientId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      subjective: note?.subjective ?? "",
      objective: note?.objective ?? "",
      assessment: note?.assessment ?? "",
      plan: note?.plan ?? "",
    },
    values: note
      ? {
          subjective: note.subjective ?? "",
          objective: note.objective ?? "",
          assessment: note.assessment ?? "",
          plan: note.plan ?? "",
        }
      : undefined,
  });

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

  const submitting = isEdit ? update.isPending : create.isPending;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit SOAP note" : "New SOAP note"}
      description={
        isEdit
          ? `Version ${note?.version ?? 1} · save creates a new revision`
          : "Subjective · Objective · Assessment · Plan"
      }
      size="lg"
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField
          label="Subjective"
          htmlFor="note-s"
          hint="Patient-reported symptoms, history of present illness, ROS."
          error={errors.subjective?.message}
        >
          <Textarea
            id="note-s"
            rows={4}
            placeholder="e.g. Patient reports 3-day history of substernal chest pressure, worse on exertion…"
            {...register("subjective")}
          />
        </FormField>

        <FormField
          label="Objective"
          htmlFor="note-o"
          hint="Exam findings, vitals, labs, imaging."
          error={errors.objective?.message}
        >
          <Textarea
            id="note-o"
            rows={4}
            placeholder="e.g. BP 142/88, HR 92, afebrile. ECG sinus rhythm…"
            {...register("objective")}
          />
        </FormField>

        <FormField
          label="Assessment"
          htmlFor="note-a"
          hint="Clinical impression, differential, working diagnosis."
          error={errors.assessment?.message}
        >
          <Textarea
            id="note-a"
            rows={4}
            placeholder="e.g. Suspected unstable angina; rule out NSTEMI…"
            {...register("assessment")}
          />
        </FormField>

        <FormField
          label="Plan"
          htmlFor="note-p"
          hint="Orders, medications, procedures, follow-up, patient education."
          error={errors.plan?.message}
        >
          <Textarea
            id="note-p"
            rows={4}
            placeholder="e.g. Trend troponin q3h, start aspirin 325 mg, cardiology consult…"
            {...register("plan")}
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting}>
            {submitting && <Loader2 className="size-4 animate-spin" />}
            {submitting ? "Saving…" : isEdit ? "Save revision" : "Save note"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}
