import { ChevronDown, Loader2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { useForm, zodResolver, z } from "@/lib/form";
import {
  useCreateMedication,
  useUpdateMedication,
} from "@/features/patients/hooks/use-medications";
import type { Medication, MedicationStatus } from "@/types";

const routes = ["oral", "iv", "im", "subcutaneous", "topical", "other"] as const;
const statuses = ["active", "paused", "discontinued"] as const;

const schema = z.object({
  name: z.string().min(1, "Drug name is required"),
  dose: z.string().min(1, "Dose is required"),
  frequency: z.string().min(1, "Frequency is required"),
  route: z.enum(routes),
  rxnorm: z.string().optional().or(z.literal("")),
  start_date: z.string().optional().or(z.literal("")),
  status: z.enum(statuses),
  prescriber: z.string().optional().or(z.literal("")),
});

type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  /** Set this to edit an existing record; omit for create. */
  medication?: Medication;
}

export function MedicationDrawer({
  open,
  onOpenChange,
  patientId,
  medication,
}: Props) {
  const isEdit = Boolean(medication);
  const create = useCreateMedication(patientId);
  const update = useUpdateMedication(patientId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: medication?.name ?? "",
      dose: medication?.dose ?? "",
      frequency: medication?.frequency ?? "",
      route: ((medication?.route ?? "oral") as (typeof routes)[number]) ?? "oral",
      rxnorm: medication?.rxnorm ?? "",
      start_date: medication?.startDate ?? "",
      status: (medication?.status ?? "active") as MedicationStatus,
      prescriber: medication?.prescriber ?? "",
    },
    // Reset defaults when the medication prop changes (drawer reused across rows)
    values: medication
      ? {
          name: medication.name,
          dose: medication.dose,
          frequency: medication.frequency,
          route: medication.route as (typeof routes)[number],
          rxnorm: medication.rxnorm ?? "",
          start_date: medication.startDate ?? "",
          status: medication.status,
          prescriber: medication.prescriber ?? "",
        }
      : undefined,
  });

  const onSubmit = handleSubmit(async (values) => {
    const payload = {
      name: values.name,
      dose: values.dose,
      frequency: values.frequency,
      route: values.route,
      rxnorm: values.rxnorm || null,
      start_date: values.start_date || null,
      status: values.status,
      prescriber: values.prescriber || null,
    };
    if (isEdit && medication) {
      await update.mutateAsync({ id: medication.id, input: payload });
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
      title={isEdit ? "Edit medication" : "New medication"}
      description={isEdit ? medication?.name : "Required fields are marked *"}
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Drug name" required htmlFor="med-name" error={errors.name?.message}>
          <Input id="med-name" placeholder="Apixaban" {...register("name")} />
        </FormField>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Dose" required htmlFor="med-dose" error={errors.dose?.message}>
            <Input id="med-dose" placeholder="5 mg" {...register("dose")} />
          </FormField>
          <FormField
            label="Frequency"
            required
            htmlFor="med-freq"
            error={errors.frequency?.message}
          >
            <Input id="med-freq" placeholder="BID" {...register("frequency")} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Route" required htmlFor="med-route" error={errors.route?.message}>
            <Select id="med-route" {...register("route")}>
              {routes.map((r) => (
                <option key={r} value={r}>
                  {labelize(r)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Status"
            required
            htmlFor="med-status"
            error={errors.status?.message}
          >
            <Select id="med-status" {...register("status")}>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </Select>
          </FormField>
        </div>

        <FormField label="Start date" htmlFor="med-start" error={errors.start_date?.message}>
          <Input id="med-start" type="date" {...register("start_date")} />
        </FormField>

        <FormField
          label="Prescriber"
          htmlFor="med-prescriber"
          error={errors.prescriber?.message}
        >
          <Input id="med-prescriber" placeholder="Dr. Müller" {...register("prescriber")} />
        </FormField>

        <FormField
          label="RxNorm code"
          htmlFor="med-rxnorm"
          hint="Optional. Standardized drug code from the US NLM RxNorm vocabulary."
          error={errors.rxnorm?.message}
        >
          <Input id="med-rxnorm" placeholder="e.g. 5640" {...register("rxnorm")} />
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
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Add medication"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <div className="relative">
      <select
        {...props}
        className="h-10 w-full rounded-full border border-border bg-white px-4 pr-9 text-sm shadow-soft ring-focus appearance-none cursor-pointer"
      />
      <ChevronDown className="size-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function labelize(v: string): string {
  return v
    .split(/[-_]/)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}
