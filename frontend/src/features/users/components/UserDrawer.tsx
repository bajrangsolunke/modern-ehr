import { ChevronDown, Loader2, Plus, X } from "lucide-react";
import type {
  Control,
  FieldErrors,
  UseFieldArrayReturn,
  UseFormRegister,
} from "react-hook-form";
import { Controller, useFieldArray } from "react-hook-form";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form";
import { useForm, zodResolver, z, mapApiError } from "@/lib/form";
import { PortraitUploader } from "@/features/patients/components/PortraitUploader";
import {
  useAssignableUsers,
  useCreateUser,
  useUpdateUser,
} from "@/features/users/hooks/use-users";
import type { AppUser } from "@/features/users/api/users-api";
import type { Role } from "@/types";

const roles = ["provider", "staff", "admin"] as const;

const baseShape = {
  full_name: z.string().max(255).optional().or(z.literal("")),
  email: z.string().email("Invalid email"),
  role: z.enum(roles),
  specialty: z.string().max(255).optional().or(z.literal("")),
  avatar_url: z.string().optional().or(z.literal("")),
};

const educationRowSchema = z.object({
  kind: z.enum(["education", "work"]),
  institution: z.string().optional().or(z.literal("")),
  title: z.string().optional().or(z.literal("")),
  field_or_specialty: z.string().optional().or(z.literal("")),
  start_year: z
    .union([z.number(), z.string(), z.literal("")])
    .optional(),
  end_year: z.union([z.number(), z.string(), z.literal("")]).optional(),
  notes: z.string().optional().or(z.literal("")),
});

const licenseRowSchema = z.object({
  license_type: z.string().optional().or(z.literal("")),
  license_number: z.string().optional().or(z.literal("")),
  issuing_state: z.string().optional().or(z.literal("")),
  issuing_authority: z.string().optional().or(z.literal("")),
  issued_date: z.string().optional().or(z.literal("")),
  expires_date: z.string().optional().or(z.literal("")),
  notes: z.string().optional().or(z.literal("")),
});

const providerShape = {
  credential: z.string().max(64).optional().or(z.literal("")),
  first_name: z.string().max(120).optional().or(z.literal("")),
  middle_name: z.string().max(120).optional().or(z.literal("")),
  last_name: z.string().max(120).optional().or(z.literal("")),
  date_of_birth: z.string().optional().or(z.literal("")),
  gender: z.string().max(32).optional().or(z.literal("")),
  npi: z.string().max(20).optional().or(z.literal("")),
  taxonomy_code: z.string().max(32).optional().or(z.literal("")),
  languages_spoken: z.string().optional().or(z.literal("")),
  ssn: z.string().max(32).optional().or(z.literal("")),
  address_line1: z.string().max(255).optional().or(z.literal("")),
  address_line2: z.string().max(255).optional().or(z.literal("")),
  city: z.string().max(120).optional().or(z.literal("")),
  zip_code: z.string().max(20).optional().or(z.literal("")),
  telephone: z.string().max(32).optional().or(z.literal("")),
  mobile: z.string().max(32).optional().or(z.literal("")),
  fax: z.string().max(32).optional().or(z.literal("")),
  time_zone: z.string().max(64).optional().or(z.literal("")),
  federal_tax_id: z.string().max(32).optional().or(z.literal("")),
  tax_id_type: z.string().max(16).optional().or(z.literal("")),
  registration_date: z.string().optional().or(z.literal("")),
  primary_service_location: z.string().max(255).optional().or(z.literal("")),
  supervising_provider_id: z.string().optional().or(z.literal("")),
  is_non_billing: z.boolean().optional(),
  education: z.array(educationRowSchema).optional(),
  licenses: z.array(licenseRowSchema).optional(),
};

const createSchema = z
  .object({
    ...baseShape,
    ...providerShape,
    password: z.string().min(8, "Min 8 characters").max(128),
  })
  .superRefine((vals, ctx) => {
    if (vals.role === "provider") {
      const required: Array<[keyof typeof vals, string]> = [
        ["first_name", "First name is required for providers"],
        ["last_name", "Last name is required for providers"],
        ["date_of_birth", "Date of birth is required for providers"],
        ["gender", "Gender is required for providers"],
        ["federal_tax_id", "Federal Tax ID is required for providers"],
      ];
      for (const [k, msg] of required) {
        const v = vals[k];
        if (!v || (typeof v === "string" && v.trim() === "")) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [k as string],
            message: msg,
          });
        }
      }
    } else if (!vals.full_name || vals.full_name.trim() === "") {
      // Staff / admin still need a full name.
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["full_name"],
        message: "Full name is required",
      });
    }
  });

const updateSchema = z
  .object({
    ...baseShape,
    ...providerShape,
    // Empty string means "don't change". Otherwise must be ≥8.
    password: z
      .string()
      .refine((v) => v === "" || v.length >= 8, "Min 8 characters"),
  })
  .superRefine((vals, ctx) => {
    if (!vals.full_name || vals.full_name.trim() === "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["full_name"],
        message: "Full name is required",
      });
    }
  });

type CreateValues = z.infer<typeof createSchema>;
type UpdateValues = z.infer<typeof updateSchema>;
type FormValues = CreateValues | UpdateValues;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Pass an existing user to switch into edit mode. */
  user?: AppUser;
}

export function UserDrawer({ open, onOpenChange, user }: Props) {
  const isEdit = Boolean(user);
  const create = useCreateUser();
  const update = useUpdateUser(user?.id);

  // Used by the supervising-provider dropdown when role === "provider".
  const { data: providersPage } = useAssignableUsers({
    role: "provider",
    page: 1,
    page_size: 100,
  });
  const providerOptions = providersPage?.items ?? [];

  /*
   * Always feed `values` (not just `defaultValues`) so RHF resets the
   * form whenever the `user` prop flips. Without this, opening Edit
   * for user A → closing → opening "New user" leaves A's fields
   * sitting in the create form because RHF treats undefined `values`
   * as "leave it alone".
   */
  const blank: FormValues = {
    full_name: "",
    email: "",
    role: "provider" as Role,
    specialty: "",
    password: "",
    avatar_url: "",
    credential: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    date_of_birth: "",
    gender: "",
    npi: "",
    taxonomy_code: "",
    languages_spoken: "",
    ssn: "",
    address_line1: "",
    address_line2: "",
    city: "",
    zip_code: "",
    telephone: "",
    mobile: "",
    fax: "",
    time_zone: "",
    federal_tax_id: "",
    tax_id_type: "",
    registration_date: "",
    primary_service_location: "",
    supervising_provider_id: "",
    is_non_billing: false,
    education: [],
    licenses: [],
  };
  const valuesFromUser: FormValues = user
    ? {
        ...blank,
        full_name: user.fullName,
        email: user.email,
        role: user.role,
        specialty: user.specialty ?? "",
        password: "",
        avatar_url: user.avatarUrl ?? "",
      }
    : blank;

  const {
    register,
    handleSubmit,
    setError,
    watch,
    setValue,
    control,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(isEdit ? updateSchema : createSchema) as never,
    defaultValues: blank,
    values: valuesFromUser,
  });

  const avatarUrl = watch("avatar_url");
  const fullNameValue = watch("full_name");
  const role = watch("role");

  const educationFields = useFieldArray({ control, name: "education" });
  const licenseFields = useFieldArray({ control, name: "licenses" });

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (isEdit && user) {
        await update.mutateAsync({
          full_name: values.full_name,
          role: values.role,
          specialty: values.specialty || null,
          avatar_url: values.avatar_url || null,
          ...(values.password ? { password: values.password } : {}),
        });
      } else if (values.role === "provider") {
        const blankStr = (v: unknown) =>
          typeof v === "string" && v.trim() === "" ? undefined : (v as string);
        const fullName =
          [values.first_name, values.middle_name, values.last_name]
            .map((s) => (s ?? "").trim())
            .filter(Boolean)
            .join(" ") ||
          (values.full_name ?? "").trim() ||
          (values.first_name ?? "").trim();

        await create.mutateAsync({
          email: values.email,
          full_name: fullName,
          role: "provider",
          password: (values as CreateValues).password,
          avatar_url: values.avatar_url || null,
          specialty: values.specialty || null,
          credential: blankStr(values.credential),
          first_name: blankStr(values.first_name),
          middle_name: blankStr(values.middle_name),
          last_name: blankStr(values.last_name),
          date_of_birth: blankStr(values.date_of_birth),
          gender: blankStr(values.gender),
          npi: blankStr(values.npi),
          taxonomy_code: blankStr(values.taxonomy_code),
          languages_spoken: blankStr(values.languages_spoken),
          ssn: blankStr(values.ssn),
          address_line1: blankStr(values.address_line1),
          address_line2: blankStr(values.address_line2),
          city: blankStr(values.city),
          zip_code: blankStr(values.zip_code),
          telephone: blankStr(values.telephone),
          mobile: blankStr(values.mobile),
          fax: blankStr(values.fax),
          time_zone: blankStr(values.time_zone),
          federal_tax_id: blankStr(values.federal_tax_id),
          tax_id_type: blankStr(values.tax_id_type),
          registration_date: blankStr(values.registration_date),
          primary_service_location: blankStr(values.primary_service_location),
          supervising_provider_id: blankStr(values.supervising_provider_id),
          is_non_billing: Boolean(values.is_non_billing),
          education: (values.education ?? [])
            .filter((e) => e.institution && e.institution.trim())
            .map((e) => ({
              kind: e.kind,
              institution: e.institution!.trim(),
              title: blankStr(e.title),
              field_or_specialty: blankStr(e.field_or_specialty),
              start_year:
                e.start_year !== "" && e.start_year !== undefined
                  ? Number(e.start_year)
                  : undefined,
              end_year:
                e.end_year !== "" && e.end_year !== undefined
                  ? Number(e.end_year)
                  : undefined,
              notes: blankStr(e.notes),
            })),
          licenses: (values.licenses ?? [])
            .filter(
              (l) =>
                l.license_type &&
                l.license_type.trim() &&
                l.license_number &&
                l.license_number.trim()
            )
            .map((l) => ({
              license_type: l.license_type!.trim(),
              license_number: l.license_number!.trim(),
              issuing_state: blankStr(l.issuing_state),
              issuing_authority: blankStr(l.issuing_authority),
              issued_date: blankStr(l.issued_date),
              expires_date: blankStr(l.expires_date),
              notes: blankStr(l.notes),
            })),
        });
      } else {
        // staff / admin — minimal payload, same shape as the original drawer.
        await create.mutateAsync({
          email: values.email,
          full_name: values.full_name ?? "",
          role: values.role,
          specialty: values.specialty || null,
          avatar_url: values.avatar_url || null,
          password: (values as CreateValues).password,
        });
      }
      onOpenChange(false);
    } catch (err) {
      mapApiError(err, setError);
    }
  });

  const submitting = isEdit ? update.isPending : create.isPending;
  const isProviderCreate = !isEdit && role === "provider";

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title={isEdit ? "Edit user" : "New user"}
      description={
        isEdit
          ? `Update profile and access for ${user?.fullName}.`
          : "Invite a new teammate. They'll sign in with the password you set."
      }
      size={isProviderCreate ? "xl" : "lg"}
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <div className="flex items-start gap-5">
          <div className="flex flex-col items-center gap-2 shrink-0">
            <PortraitUploader
              name={fullNameValue || "New user"}
              src={avatarUrl || undefined}
              onChange={(dataUrl) =>
                setValue("avatar_url", dataUrl, { shouldDirty: true })
              }
            />
            <span className="text-[11px] text-muted-foreground text-center max-w-[140px] leading-snug">
              Optional. Resized to passport size.
            </span>
          </div>

          <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4 auto-rows-min">
            <FormField
              label="Full name"
              required={!isProviderCreate}
              htmlFor="u-name"
              hint={
                isProviderCreate
                  ? "Auto-built from first / middle / last below."
                  : undefined
              }
              error={errors.full_name?.message}
            >
              <Input
                id="u-name"
                placeholder="Dr. Jane Cooper"
                {...register("full_name")}
              />
            </FormField>

            <FormField
              label="Email"
              required
              htmlFor="u-email"
              hint={
                isEdit
                  ? "Email is the durable identity and can't be changed."
                  : undefined
              }
              error={errors.email?.message}
            >
              <Input
                id="u-email"
                type="email"
                placeholder="jane@padmavat.health"
                disabled={isEdit}
                {...register("email")}
              />
            </FormField>

            <FormField
              label="Role"
              required
              htmlFor="u-role"
              error={errors.role?.message}
            >
              <Select id="u-role" {...register("role")}>
                <option value="provider">Provider</option>
                <option value="staff">Staff</option>
                <option value="admin">Admin</option>
              </Select>
            </FormField>

            <FormField
              label="Specialty"
              htmlFor="u-specialty"
              hint={role === "provider" ? "e.g. Orthopedics" : "Optional"}
              error={errors.specialty?.message}
            >
              <Input id="u-specialty" {...register("specialty")} />
            </FormField>
          </div>
        </div>
        <input type="hidden" {...register("avatar_url")} />

        <FormField
          label={isEdit ? "Reset password" : "Password"}
          required={!isEdit}
          htmlFor="u-password"
          hint={
            isEdit
              ? "Leave blank to keep the current password."
              : "Minimum 8 characters."
          }
          error={errors.password?.message}
        >
          <Input
            id="u-password"
            type="password"
            autoComplete="new-password"
            {...register("password")}
          />
        </FormField>

        {isProviderCreate && (
          <>
            <ProviderBasicSection
              register={register}
              control={control}
              errors={errors as FieldErrors<CreateValues>}
            />
            <ProviderContactSection
              register={register}
              errors={errors as FieldErrors<CreateValues>}
            />
            <ProviderOtherSection
              register={register}
              control={control}
              providerOptions={providerOptions}
              errors={errors as FieldErrors<CreateValues>}
            />
            <ProviderEducationSection
              register={register}
              control={control}
              fields={educationFields}
            />
            <ProviderLicensesSection
              register={register}
              fields={licenseFields}
            />
          </>
        )}

        <div className="sticky bottom-0 -mx-6 px-6 py-3 bg-[#F5F9FF] border-t border-border flex justify-end gap-2">
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
            {submitting ? "Saving…" : isEdit ? "Save changes" : "Create user"}
          </Button>
        </div>
      </form>
    </Drawer>
  );
}

/* -------------------------------------------------------------------------- */
/*                            Provider sections                               */
/* -------------------------------------------------------------------------- */

interface SectionProps {
  register: UseFormRegister<FormValues>;
  errors: FieldErrors<CreateValues>;
}

function ProviderBasicSection({
  register,
  control,
  errors,
}: SectionProps & { control: Control<FormValues> }) {
  return (
    <SectionCard title="Basic Details">
      <FormField label="Credential" htmlFor="pd-credential">
        <Input
          id="pd-credential"
          placeholder="MD, DO, NP…"
          {...register("credential")}
        />
      </FormField>
      <FormField
        label="First name"
        required
        htmlFor="pd-first"
        error={errors.first_name?.message}
      >
        <Input id="pd-first" {...register("first_name")} />
      </FormField>
      <FormField label="Middle name" htmlFor="pd-middle">
        <Input id="pd-middle" {...register("middle_name")} />
      </FormField>
      <FormField
        label="Last name"
        required
        htmlFor="pd-last"
        error={errors.last_name?.message}
      >
        <Input id="pd-last" {...register("last_name")} />
      </FormField>
      <FormField
        label="Date of birth"
        required
        htmlFor="pd-dob"
        error={errors.date_of_birth?.message}
      >
        <Input id="pd-dob" type="date" {...register("date_of_birth")} />
      </FormField>
      <FormField
        label="Gender"
        required
        htmlFor="pd-gender"
        error={errors.gender?.message}
      >
        <Controller
          control={control}
          name="gender"
          render={({ field }) => (
            <Select
              id="pd-gender"
              value={(field.value as string) ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
            >
              <option value="">Select…</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non_binary">Non-binary</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </Select>
          )}
        />
      </FormField>
      <FormField label="NPI" htmlFor="pd-npi">
        <Input
          id="pd-npi"
          placeholder="10-digit national provider ID"
          {...register("npi")}
        />
      </FormField>
      <FormField label="Taxonomy code" htmlFor="pd-taxonomy">
        <Input id="pd-taxonomy" {...register("taxonomy_code")} />
      </FormField>
      <FormField label="Languages spoken" htmlFor="pd-languages">
        <Input
          id="pd-languages"
          placeholder="English, Spanish…"
          {...register("languages_spoken")}
        />
      </FormField>
      <FormField label="SSN" htmlFor="pd-ssn" hint="Stored encrypted at rest.">
        <Input id="pd-ssn" autoComplete="off" {...register("ssn")} />
      </FormField>
    </SectionCard>
  );
}

function ProviderContactSection({ register, errors }: SectionProps) {
  return (
    <SectionCard title="Contact Details">
      <FormField label="Address line 1" htmlFor="pd-addr1">
        <Input id="pd-addr1" {...register("address_line1")} />
      </FormField>
      <FormField label="Address line 2" htmlFor="pd-addr2">
        <Input id="pd-addr2" {...register("address_line2")} />
      </FormField>
      <FormField label="City" htmlFor="pd-city">
        <Input id="pd-city" {...register("city")} />
      </FormField>
      <FormField label="Zip code" htmlFor="pd-zip">
        <Input id="pd-zip" {...register("zip_code")} />
      </FormField>
      <FormField label="Telephone" htmlFor="pd-tel">
        <Input id="pd-tel" type="tel" {...register("telephone")} />
      </FormField>
      <FormField label="Mobile" htmlFor="pd-mobile">
        <Input id="pd-mobile" type="tel" {...register("mobile")} />
      </FormField>
      <FormField label="Fax" htmlFor="pd-fax">
        <Input id="pd-fax" {...register("fax")} />
      </FormField>
      <FormField label="Time zone" htmlFor="pd-tz">
        <Input
          id="pd-tz"
          placeholder="America/Los_Angeles"
          {...register("time_zone")}
        />
      </FormField>
      {/* Email already lives in the common section above — providers share
          the same identity input. The hint here makes that link obvious. */}
      <FormField
        label="Email"
        hint="Provider email is set in the section above."
        htmlFor="pd-email-hint"
      >
        <Input id="pd-email-hint" disabled placeholder="See above" />
      </FormField>
      <input type="hidden" />
      {errors ? null : null}
    </SectionCard>
  );
}

function ProviderOtherSection({
  register,
  control,
  providerOptions,
  errors,
}: SectionProps & {
  control: Control<FormValues>;
  providerOptions: AppUser[];
}) {
  return (
    <SectionCard title="Other Details">
      <FormField
        label="Federal tax ID"
        required
        htmlFor="pd-ftid"
        hint="Stored encrypted at rest."
        error={errors.federal_tax_id?.message}
      >
        <Input
          id="pd-ftid"
          autoComplete="off"
          {...register("federal_tax_id")}
        />
      </FormField>
      <FormField label="Tax ID type" htmlFor="pd-tax-type">
        <Controller
          control={control}
          name="tax_id_type"
          render={({ field }) => (
            <Select
              id="pd-tax-type"
              value={(field.value as string) ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
            >
              <option value="">Select…</option>
              <option value="EIN">EIN</option>
              <option value="SSN">SSN</option>
              <option value="ITIN">ITIN</option>
            </Select>
          )}
        />
      </FormField>
      <FormField label="Registration date" htmlFor="pd-regdate">
        <Input
          id="pd-regdate"
          type="date"
          {...register("registration_date")}
        />
      </FormField>
      <FormField label="Primary service location" htmlFor="pd-loc">
        <Input id="pd-loc" {...register("primary_service_location")} />
      </FormField>
      <FormField
        label="Supervising provider"
        htmlFor="pd-supervisor"
        hint={
          providerOptions.length === 0
            ? "No active providers to pick from yet."
            : undefined
        }
      >
        <Controller
          control={control}
          name="supervising_provider_id"
          render={({ field }) => (
            <Select
              id="pd-supervisor"
              value={(field.value as string) ?? ""}
              onChange={(e) => field.onChange(e.target.value)}
            >
              <option value="">None</option>
              {providerOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </Select>
          )}
        />
      </FormField>
      <FormField label="Billing" htmlFor="pd-nonbill">
        <label className="flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-white shadow-soft text-sm cursor-pointer">
          <input
            id="pd-nonbill"
            type="checkbox"
            className="size-4 accent-primary"
            {...register("is_non_billing")}
          />
          Non-billing provider
        </label>
      </FormField>
    </SectionCard>
  );
}

function ProviderEducationSection({
  register,
  control,
  fields,
}: {
  register: UseFormRegister<FormValues>;
  control: Control<FormValues>;
  fields: UseFieldArrayReturn<FormValues, "education">;
}) {
  return (
    <RepeaterCard
      title="Education & Work Experience"
      onAdd={() =>
        fields.append({
          kind: "education",
          institution: "",
        })
      }
      emptyLabel="No education or work history added yet."
      rowCount={fields.fields.length}
    >
      {fields.fields.map((row, idx) => (
        <RepeaterRow key={row.id} onRemove={() => fields.remove(idx)}>
          <FormField label="Kind">
            <Controller
              control={control}
              name={`education.${idx}.kind` as const}
              render={({ field }) => (
                <Select
                  value={(field.value as string) ?? "education"}
                  onChange={(e) => field.onChange(e.target.value)}
                >
                  <option value="education">Education</option>
                  <option value="work">Work</option>
                </Select>
              )}
            />
          </FormField>
          <FormField label="Institution">
            <Input {...register(`education.${idx}.institution` as const)} />
          </FormField>
          <FormField label="Title / degree">
            <Input {...register(`education.${idx}.title` as const)} />
          </FormField>
          <FormField label="Field or specialty">
            <Input
              {...register(`education.${idx}.field_or_specialty` as const)}
            />
          </FormField>
          <FormField label="Start year">
            <Input
              type="number"
              inputMode="numeric"
              {...register(`education.${idx}.start_year` as const)}
            />
          </FormField>
          <FormField label="End year">
            <Input
              type="number"
              inputMode="numeric"
              {...register(`education.${idx}.end_year` as const)}
            />
          </FormField>
          <FormField label="Notes" className="md:col-span-2">
            <Textarea
              rows={2}
              {...register(`education.${idx}.notes` as const)}
            />
          </FormField>
        </RepeaterRow>
      ))}
    </RepeaterCard>
  );
}

function ProviderLicensesSection({
  register,
  fields,
}: {
  register: UseFormRegister<FormValues>;
  fields: UseFieldArrayReturn<FormValues, "licenses">;
}) {
  return (
    <RepeaterCard
      title="Licensing and Compliance"
      onAdd={() =>
        fields.append({
          license_type: "",
          license_number: "",
        })
      }
      emptyLabel="No licenses added yet."
      rowCount={fields.fields.length}
    >
      {fields.fields.map((row, idx) => (
        <RepeaterRow key={row.id} onRemove={() => fields.remove(idx)}>
          <FormField label="License type">
            <Input {...register(`licenses.${idx}.license_type` as const)} />
          </FormField>
          <FormField label="License number">
            <Input {...register(`licenses.${idx}.license_number` as const)} />
          </FormField>
          <FormField label="Issuing state">
            <Input {...register(`licenses.${idx}.issuing_state` as const)} />
          </FormField>
          <FormField label="Issuing authority">
            <Input
              {...register(`licenses.${idx}.issuing_authority` as const)}
            />
          </FormField>
          <FormField label="Issued date">
            <Input
              type="date"
              {...register(`licenses.${idx}.issued_date` as const)}
            />
          </FormField>
          <FormField label="Expires date">
            <Input
              type="date"
              {...register(`licenses.${idx}.expires_date` as const)}
            />
          </FormField>
          <FormField label="Notes" className="md:col-span-2">
            <Textarea
              rows={2}
              {...register(`licenses.${idx}.notes` as const)}
            />
          </FormField>
        </RepeaterRow>
      ))}
    </RepeaterCard>
  );
}

/* -------------------------------------------------------------------------- */
/*                                Primitives                                  */
/* -------------------------------------------------------------------------- */

function SectionCard({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 space-y-4">
      <h2 className="text-base font-semibold">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </Card>
  );
}

function RepeaterCard({
  title,
  onAdd,
  emptyLabel,
  rowCount,
  children,
}: {
  title: string;
  onAdd: () => void;
  emptyLabel: string;
  rowCount: number;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <Button size="sm" variant="secondary" onClick={onAdd} type="button">
          <Plus className="size-3.5" /> Add row
        </Button>
      </div>
      {rowCount === 0 && (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
      <div className="space-y-3">{children}</div>
    </Card>
  );
}

function RepeaterRow({
  onRemove,
  children,
}: {
  onRemove: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border rounded-2xl p-4 space-y-3 relative">
      <button
        type="button"
        aria-label="Remove"
        className="absolute top-2 right-2 size-7 rounded-full grid place-items-center hover:bg-secondary text-muted-foreground hover:text-foreground"
        onClick={onRemove}
      >
        <X className="size-4" />
      </button>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">{children}</div>
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
