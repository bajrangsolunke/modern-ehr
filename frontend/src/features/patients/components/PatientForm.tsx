import { ChevronDown, Loader2 } from "lucide-react";
import { useForm, zodResolver, z } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { PortraitUploader } from "@/features/patients/components/PortraitUploader";
import { useUsers } from "@/features/users/hooks/use-users";
import type { PatientInput } from "@/features/patients/api/patients-api";
import type { Patient } from "@/types";

const sexes = ["F", "M", "O"] as const;
const asas = ["I", "II", "III", "IV"] as const;
const statuses = ["scheduled", "ready", "in-progress", "at-risk", "discharged"] as const;
const risks = ["low", "moderate", "high", "critical"] as const;

const schema = z.object({
  mrn: z.string().min(1, "MRN is required"),
  first_name: z.string().min(1, "First name is required"),
  last_name: z.string().min(1, "Last name is required"),
  sex: z.enum(sexes),
  dob: z.string().min(1, "Date of birth is required"),
  email: z.string().email("Invalid email").optional().or(z.literal("")),
  phone: z.string().optional().or(z.literal("")),
  city: z.string().optional().or(z.literal("")),
  avatar_url: z.string().optional().or(z.literal("")),
  assigned_physician_id: z.string().optional().or(z.literal("")),
  procedure: z.string().optional().or(z.literal("")),
  procedure_date: z.string().optional().or(z.literal("")),
  asa: z.enum(asas).optional().or(z.literal("")),
  icu_needed: z.boolean(),
  status: z.enum(statuses),
  risk: z.enum(risks),
  tags: z.string().optional().or(z.literal("")),
});

export type PatientFormValues = z.infer<typeof schema>;

interface Props {
  defaultPatient?: Patient;
  submitting?: boolean;
  submitLabel?: string;
  onCancel?: () => void;
  onSubmit: (input: PatientInput) => void | Promise<void>;
}

export function PatientForm({
  defaultPatient,
  submitting,
  submitLabel = "Save",
  onCancel,
  onSubmit,
}: Props) {
  const defaults: PatientFormValues = {
    mrn: defaultPatient?.mrn ?? "",
    first_name: defaultPatient?.firstName ?? "",
    last_name: defaultPatient?.lastName ?? "",
    sex: defaultPatient?.sex ?? "F",
    dob: defaultPatient?.dob ?? "",
    email: defaultPatient?.email ?? "",
    phone: defaultPatient?.phone ?? "",
    city: defaultPatient?.city ?? "",
    avatar_url: defaultPatient?.avatarUrl ?? "",
    assigned_physician_id: defaultPatient?.assignedPhysician?.id ?? "",
    procedure: defaultPatient?.procedure ?? "",
    procedure_date: defaultPatient?.procedureDate ?? "",
    asa: (defaultPatient?.asa as (typeof asas)[number]) ?? "",
    icu_needed: defaultPatient?.icu ?? false,
    status: defaultPatient?.status ?? "scheduled",
    risk: defaultPatient?.risk ?? "low",
    tags: defaultPatient?.tags?.join(", ") ?? "",
  };

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<PatientFormValues>({
    resolver: zodResolver(schema),
    defaultValues: defaults,
  });

  const avatarUrl = watch("avatar_url");
  const firstName = watch("first_name");
  const lastName = watch("last_name");
  const portraitName = `${firstName ?? ""} ${lastName ?? ""}`.trim() || "New patient";

  const submit = handleSubmit(async (values) => {
    const input: PatientInput = {
      mrn: values.mrn,
      first_name: values.first_name,
      last_name: values.last_name,
      sex: values.sex,
      dob: values.dob,
      email: values.email || null,
      phone: values.phone || null,
      city: values.city || null,
      avatar_url: values.avatar_url || null,
      assigned_physician_id: values.assigned_physician_id || null,
      procedure: values.procedure || null,
      procedure_date: values.procedure_date || null,
      asa: (values.asa || null) as PatientInput["asa"],
      icu_needed: values.icu_needed,
      status: values.status,
      risk: values.risk,
      tags: values.tags
        ? values.tags
            .split(",")
            .map((t) => t.trim())
            .filter(Boolean)
        : null,
    };
    await onSubmit(input);
  });

  return (
    <form onSubmit={submit} className="space-y-4 lg:space-y-5" noValidate>
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-[15px]">Identity</CardTitle>
        </CardHeader>
        <CardContent className="pb-5">
          <div className="flex items-start gap-5">
            <div className="flex flex-col items-center gap-2 shrink-0">
              <PortraitUploader
                name={portraitName}
                src={avatarUrl || undefined}
                onChange={(dataUrl) =>
                  setValue("avatar_url", dataUrl, { shouldDirty: true })
                }
              />
              <span className="text-[11px] text-muted-foreground text-center max-w-[140px] leading-snug">
                Optional. Resized to passport size.
              </span>
            </div>

            <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 auto-rows-min">
              <FormField label="MRN" required htmlFor="mrn" error={errors.mrn?.message}>
                <Input id="mrn" placeholder="e.g. 1042" {...register("mrn")} />
              </FormField>
              <FormField label="Sex" required htmlFor="sex" error={errors.sex?.message}>
                <Select id="sex" {...register("sex")}>
                  {sexes.map((s) => (
                    <option key={s} value={s}>
                      {s === "F" ? "Female" : s === "M" ? "Male" : "Other"}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField
                label="Date of birth"
                required
                htmlFor="dob"
                error={errors.dob?.message}
              >
                <Input id="dob" type="date" {...register("dob")} />
              </FormField>
              <FormField
                label="First name"
                required
                htmlFor="first_name"
                error={errors.first_name?.message}
              >
                <Input
                  id="first_name"
                  {...register("first_name")}
                  placeholder="Robert"
                />
              </FormField>
              <FormField
                label="Last name"
                required
                htmlFor="last_name"
                error={errors.last_name?.message}
              >
                <Input id="last_name" {...register("last_name")} placeholder="Fox" />
              </FormField>
              <FormField label="City" htmlFor="city" error={errors.city?.message}>
                <Input id="city" {...register("city")} placeholder="Berlin, Germany" />
              </FormField>
            </div>
          </div>
          <input type="hidden" {...register("avatar_url")} />
        </CardContent>
      </Card>

      <Section title="Contact">
        <Field span={2}>
          <FormField label="Email" htmlFor="email" error={errors.email?.message}>
            <Input
              id="email"
              type="email"
              placeholder="patient@example.org"
              {...register("email")}
            />
          </FormField>
        </Field>
        <Field>
          <FormField label="Phone" htmlFor="phone" error={errors.phone?.message}>
            <Input id="phone" type="tel" placeholder="+49…" {...register("phone")} />
          </FormField>
        </Field>
      </Section>

      <Section title="Clinical">
        <Field span={2}>
          <FormField
            label="Planned procedure"
            htmlFor="procedure"
            error={errors.procedure?.message}
          >
            <Input
              id="procedure"
              placeholder="Hip Replacement"
              {...register("procedure")}
            />
          </FormField>
        </Field>
        <Field>
          <FormField
            label="Procedure date"
            htmlFor="procedure_date"
            error={errors.procedure_date?.message}
          >
            <Input id="procedure_date" type="date" {...register("procedure_date")} />
          </FormField>
        </Field>
        <Field>
          <FormField label="ASA class" htmlFor="asa" error={errors.asa?.message}>
            <Select id="asa" {...register("asa")}>
              <option value="">—</option>
              {asas.map((a) => (
                <option key={a} value={a}>
                  ASA {a}
                </option>
              ))}
            </Select>
          </FormField>
        </Field>
        <Field span={2}>
          <FormField label="ICU bed" htmlFor="icu_needed">
            <label
              htmlFor="icu_needed"
              className="flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-white shadow-soft cursor-pointer"
            >
              <input
                id="icu_needed"
                type="checkbox"
                className="size-4 rounded border-border accent-primary"
                {...register("icu_needed")}
              />
              <span className="text-sm">Reserve ICU bed post-op</span>
            </label>
          </FormField>
        </Field>
      </Section>

      <Section title="Care plan">
        <Field span={3}>
          <FormField
            label="Assigned provider"
            htmlFor="assigned_physician_id"
            hint="Optional. Pick the provider who's primarily responsible for this patient."
            error={errors.assigned_physician_id?.message}
          >
            <ProviderPicker
              value={watch("assigned_physician_id") || ""}
              onChange={(id) =>
                setValue("assigned_physician_id", id, { shouldDirty: true })
              }
            />
            <input type="hidden" {...register("assigned_physician_id")} />
          </FormField>
        </Field>
        <Field>
          <FormField
            label="Status"
            required
            htmlFor="status"
            error={errors.status?.message}
          >
            <Select id="status" {...register("status")}>
              {statuses.map((s) => (
                <option key={s} value={s}>
                  {labelFor(s)}
                </option>
              ))}
            </Select>
          </FormField>
        </Field>
        <Field>
          <FormField
            label="Risk level"
            required
            htmlFor="risk"
            error={errors.risk?.message}
          >
            <Select id="risk" {...register("risk")}>
              {risks.map((r) => (
                <option key={r} value={r}>
                  {labelFor(r)}
                </option>
              ))}
            </Select>
          </FormField>
        </Field>
        <Field>
          <FormField
            label="Tags"
            htmlFor="tags"
            hint="Comma separated"
            error={errors.tags?.message}
          >
            <Input
              id="tags"
              {...register("tags")}
              placeholder="#ASA II, #ICU needed"
            />
          </FormField>
        </Field>
      </Section>

      <div className="flex items-center justify-end gap-2 pt-2">
        {onCancel && (
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={submitting}
            className="h-10"
          >
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={submitting} className="h-10">
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? "Saving…" : submitLabel}
        </Button>
      </div>
    </form>
  );
}

/* Sectioned card. Children render into a 3-col grid; each Field can
   span 1, 2, or 3 columns. */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-[15px]">{title}</CardTitle>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 lg:gap-4 auto-rows-min">
          {children}
        </div>
      </CardContent>
    </Card>
  );
}

function Field({
  children,
  span = 1,
}: {
  children: React.ReactNode;
  span?: 1 | 2 | 3;
}) {
  return (
    <div
      className={cn(
        span === 2 && "lg:col-span-2",
        span === 3 && "lg:col-span-3 sm:col-span-2"
      )}
    >
      {children}
    </div>
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

function labelFor(v: string) {
  return v
    .split(/[-_]/)
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(" ");
}

function ProviderPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (id: string) => void;
}) {
  // Active providers only — staff and admins aren't clinicians and
  // shouldn't be the "assigned provider" on a chart.
  const { data } = useUsers({
    role: "provider",
    is_active: true,
    page: 1,
    page_size: 100,
  });
  return (
    <Select
      id="assigned_physician_id"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      <option value="">Unassigned</option>
      {(data?.items ?? []).map((u) => (
        <option key={u.id} value={u.id}>
          {u.fullName}
          {u.specialty ? ` · ${u.specialty}` : ""}
        </option>
      ))}
    </Select>
  );
}
