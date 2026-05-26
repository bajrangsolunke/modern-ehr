import { ChevronDown, Loader2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form";
import { useForm, zodResolver, z } from "@/lib/form";
import { useCreateAlert } from "@/features/patients/hooks/use-patient-alerts";
import type { AlertSeverity } from "@/features/patients/api/alerts-api";

const severities = ["critical", "warning", "info"] as const;

const schema = z.object({
  severity: z.enum(severities),
  label: z.string().min(1, "Label is required").max(128),
  detail: z.string().max(4000).optional().or(z.literal("")),
});

type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
}

export function AlertDrawer({ open, onOpenChange, patientId }: Props) {
  const create = useCreateAlert(patientId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      severity: "warning" as AlertSeverity,
      label: "",
      detail: "",
    },
  });

  const onSubmit = handleSubmit(async (values) => {
    await create.mutateAsync({
      patient_id: patientId,
      severity: values.severity,
      label: values.label,
      detail: values.detail || null,
    });
    onOpenChange(false);
    reset();
  });

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="New alert"
      description="Surface a fact every clinician should see at a glance."
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Severity" required htmlFor="alert-severity" error={errors.severity?.message}>
          <Select id="alert-severity" {...register("severity")}>
            <option value="critical">Critical — red, must-see</option>
            <option value="warning">Warning — yellow, watch</option>
            <option value="info">Info — blue, FYI</option>
          </Select>
        </FormField>

        <FormField
          label="Label"
          required
          htmlFor="alert-label"
          hint="Short — fits on a chip. e.g. “Blood thinner”, “DNR”, “Falls risk”."
          error={errors.label?.message}
        >
          <Input id="alert-label" placeholder="Blood thinner" {...register("label")} />
        </FormField>

        <FormField
          label="Detail"
          htmlFor="alert-detail"
          hint="Optional. Shown next to the label on hover / wider screens."
          error={errors.detail?.message}
        >
          <Textarea
            id="alert-detail"
            rows={3}
            placeholder="Apixaban — paused 12.05.2025"
            {...register("detail")}
          />
        </FormField>

        <div className="flex justify-end gap-2 pt-2">
          <Button
            type="button"
            variant="secondary"
            onClick={() => onOpenChange(false)}
            disabled={create.isPending}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending && <Loader2 className="size-4 animate-spin" />}
            {create.isPending ? "Saving…" : "Add alert"}
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
