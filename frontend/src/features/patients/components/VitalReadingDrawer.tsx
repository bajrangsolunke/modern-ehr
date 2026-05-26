import { ChevronDown, Loader2 } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { useForm, zodResolver, z } from "@/lib/form";
import { useCreateVital } from "@/features/patients/hooks/use-vitals";
import {
  VITAL_METRIC_LIST,
  VITAL_METRICS,
  type VitalMetricKey,
} from "@/features/patients/lib/vital-metrics";

const metricKeys = VITAL_METRIC_LIST.map((m) => m.key) as [
  VitalMetricKey,
  ...VitalMetricKey[],
];
const sources = ["manual", "device", "imported"] as const;

const schema = z.object({
  metric: z.enum(metricKeys),
  value: z
    .number({ message: "Enter a number" })
    .min(0, "Must be ≥ 0")
    .max(1000, "Out of range"),
  unit: z.string().optional().or(z.literal("")),
  source: z.enum(sources),
  recorded_at: z.string().optional().or(z.literal("")),
});

type Values = z.infer<typeof schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  patientId: string;
  /** Pre-select a metric (e.g. from a tile's "Add reading" button). */
  defaultMetric?: VitalMetricKey;
}

export function VitalReadingDrawer({
  open,
  onOpenChange,
  patientId,
  defaultMetric,
}: Props) {
  const create = useCreateVital(patientId);

  const initialMetric = defaultMetric ?? "heart_rate";
  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: {
      metric: initialMetric,
      value: 0,
      unit: VITAL_METRICS[initialMetric].defaultUnit,
      source: "manual",
      recorded_at: "",
    },
    // Reset when the drawer is opened with a different default metric.
    values: defaultMetric
      ? {
          metric: defaultMetric,
          value: 0,
          unit: VITAL_METRICS[defaultMetric].defaultUnit,
          source: "manual",
          recorded_at: "",
        }
      : undefined,
  });

  const metric = watch("metric");
  const meta = VITAL_METRICS[metric];

  const onSubmit = handleSubmit(async (values) => {
    await create.mutateAsync({
      patient_id: patientId,
      metric: values.metric,
      value: Number(values.value),
      unit: values.unit || meta.defaultUnit,
      source: values.source,
      recorded_at: values.recorded_at ? new Date(values.recorded_at).toISOString() : undefined,
    });
    onOpenChange(false);
    reset();
  });

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="New reading"
      description={
        meta.normal
          ? `${meta.label} · normal ${meta.normal[0]}–${meta.normal[1]} ${meta.defaultUnit}`
          : meta.label
      }
      size="md"
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <FormField label="Metric" required htmlFor="vital-metric" error={errors.metric?.message}>
          <Select
            id="vital-metric"
            {...register("metric", {
              onChange: (e) => {
                const next = e.target.value as VitalMetricKey;
                setValue("unit", VITAL_METRICS[next].defaultUnit, { shouldDirty: true });
              },
            })}
          >
            {VITAL_METRIC_LIST.map((m) => (
              <option key={m.key} value={m.key}>
                {m.label} ({m.defaultUnit})
              </option>
            ))}
          </Select>
        </FormField>

        <div className="grid grid-cols-3 gap-3">
          <FormField
            label="Value"
            required
            htmlFor="vital-value"
            error={errors.value?.message}
            className="col-span-2"
          >
            <Input
              id="vital-value"
              type="number"
              step={meta.step ?? 1}
              inputMode="decimal"
              placeholder={meta.normal ? String(meta.normal[0]) : ""}
              {...register("value", { valueAsNumber: true })}
            />
          </FormField>
          <FormField label="Unit" htmlFor="vital-unit" error={errors.unit?.message}>
            <Input id="vital-unit" placeholder={meta.defaultUnit} {...register("unit")} />
          </FormField>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormField label="Source" required htmlFor="vital-source" error={errors.source?.message}>
            <Select id="vital-source" {...register("source")}>
              {sources.map((s) => (
                <option key={s} value={s}>
                  {labelize(s)}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField
            label="Recorded at"
            htmlFor="vital-recorded"
            hint="Leave blank to use the current time."
            error={errors.recorded_at?.message}
          >
            <Input
              id="vital-recorded"
              type="datetime-local"
              {...register("recorded_at")}
            />
          </FormField>
        </div>

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
            {create.isPending ? "Saving…" : "Record reading"}
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
  return v[0].toUpperCase() + v.slice(1);
}
