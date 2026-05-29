/**
 * Full-page provider creation form. Replaces the create flow inside
 * <UserDrawer> (the drawer still handles the edit flow). Sections are
 * laid out top-to-bottom — Basic, Contact, Other, Education/Work,
 * Licenses — with a sticky save bar at the bottom of the viewport.
 */
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, Loader2, Plus, X } from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form";
import { useAssignableUsers, useCreateUser } from "@/features/users/hooks/use-users";
import type {
  ProviderEducationInput,
  ProviderLicenseInput,
  UserCreateInput,
} from "@/features/users/api/users-api";
import { toast } from "@/lib/toast";
import type { Role } from "@/types";

type FormState = UserCreateInput;

const REQUIRED_FIELDS = [
  "first_name",
  "last_name",
  "date_of_birth",
  "gender",
  "email",
  "federal_tax_id",
] as const;

type RequiredField = (typeof REQUIRED_FIELDS)[number];

type FieldErrors = Partial<Record<RequiredField, string>>;

const blankEducation: ProviderEducationInput = {
  kind: "education",
  institution: "",
};

const blankLicense: ProviderLicenseInput = {
  license_type: "",
  license_number: "",
};

export function NewUserPage() {
  const navigate = useNavigate();
  const create = useCreateUser();

  const [form, setForm] = useState<FormState>({
    email: "",
    full_name: "",
    role: "provider",
    is_non_billing: false,
    education: [],
    licenses: [],
  });
  const [errors, setErrors] = useState<FieldErrors>({});

  // Supervising provider picker — reuse the existing assignable-users
  // hook so we don't add a new API method just for this dropdown.
  const { data: providersPage } = useAssignableUsers({
    role: "provider",
    page: 1,
    page_size: 100,
  });
  const providerOptions = providersPage?.items ?? [];

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    // Clear the error for this field as soon as the user touches it.
    if ((REQUIRED_FIELDS as readonly string[]).includes(key as string)) {
      setErrors((prev) => {
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key as RequiredField];
        return next;
      });
    }
  };

  /* ------------------------------ Education ----------------------------- */
  const educationRows = form.education ?? [];
  const addEducationRow = () =>
    update("education", [...educationRows, { ...blankEducation }]);
  const removeEducationRow = (idx: number) =>
    update(
      "education",
      educationRows.filter((_, i) => i !== idx)
    );
  const updateEducationRow = <K extends keyof ProviderEducationInput>(
    idx: number,
    key: K,
    value: ProviderEducationInput[K]
  ) =>
    update(
      "education",
      educationRows.map((row, i) =>
        i === idx ? { ...row, [key]: value } : row
      )
    );

  /* ------------------------------- Licenses ----------------------------- */
  const licenseRows = form.licenses ?? [];
  const addLicenseRow = () =>
    update("licenses", [...licenseRows, { ...blankLicense }]);
  const removeLicenseRow = (idx: number) =>
    update(
      "licenses",
      licenseRows.filter((_, i) => i !== idx)
    );
  const updateLicenseRow = <K extends keyof ProviderLicenseInput>(
    idx: number,
    key: K,
    value: ProviderLicenseInput[K]
  ) =>
    update(
      "licenses",
      licenseRows.map((row, i) =>
        i === idx ? { ...row, [key]: value } : row
      )
    );

  /* -------------------------------- Submit ------------------------------ */
  const submitting = create.isPending;

  const validate = (): FieldErrors => {
    const next: FieldErrors = {};
    if (!form.first_name?.trim()) next.first_name = "First name is required";
    if (!form.last_name?.trim()) next.last_name = "Last name is required";
    if (!form.date_of_birth?.trim())
      next.date_of_birth = "Date of birth is required";
    if (!form.gender?.trim()) next.gender = "Gender is required";
    if (!form.email?.trim()) next.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
      next.email = "Enter a valid email";
    if (!form.federal_tax_id?.trim())
      next.federal_tax_id = "Federal tax ID is required";
    return next;
  };

  const handleSubmit = async () => {
    const next = validate();
    setErrors(next);
    if (Object.keys(next).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    const fullName = [form.first_name, form.middle_name, form.last_name]
      .map((s) => s?.trim())
      .filter(Boolean)
      .join(" ");

    // Drop empty sub-rows so we don't ship blanks the backend will reject.
    const education = (form.education ?? [])
      .map((row) => ({
        ...row,
        institution: row.institution?.trim() ?? "",
      }))
      .filter((row) => row.institution);
    const licenses = (form.licenses ?? [])
      .map((row) => ({
        ...row,
        license_type: row.license_type?.trim() ?? "",
        license_number: row.license_number?.trim() ?? "",
      }))
      .filter((row) => row.license_type && row.license_number);

    const payload: UserCreateInput = {
      ...form,
      full_name: fullName,
      education: education.length ? education : undefined,
      licenses: licenses.length ? licenses : undefined,
    };

    try {
      const created = await create.mutateAsync(payload);
      toast.success("Provider created");
      navigate(`/users/${created.id}`);
    } catch (err) {
      // useCreateUser already toasts via onError; only catch here so we
      // don't navigate on failure.
      void err;
    }
  };

  const cancel = () => navigate(-1);

  return (
    <>
      <PageHeader
        title="Add new provider"
        subtitle="Provider profile, contact, credentialing, and license info."
        right={
          <Button variant="ghost" onClick={cancel} disabled={submitting}>
            Cancel
          </Button>
        }
      />

      <div className="space-y-6 pb-28">
        {/* ------------------------------ Basic ----------------------------- */}
        <Section title="Basic Details">
          <FormField label="Credential" htmlFor="np-credential">
            <Input
              id="np-credential"
              placeholder="MD, DO, NP…"
              value={form.credential ?? ""}
              onChange={(e) => update("credential", e.target.value)}
            />
          </FormField>
          <FormField
            label="First name"
            required
            htmlFor="np-first"
            error={errors.first_name}
          >
            <Input
              id="np-first"
              value={form.first_name ?? ""}
              onChange={(e) => update("first_name", e.target.value)}
            />
          </FormField>
          <FormField label="Middle name" htmlFor="np-middle">
            <Input
              id="np-middle"
              value={form.middle_name ?? ""}
              onChange={(e) => update("middle_name", e.target.value)}
            />
          </FormField>
          <FormField
            label="Last name"
            required
            htmlFor="np-last"
            error={errors.last_name}
          >
            <Input
              id="np-last"
              value={form.last_name ?? ""}
              onChange={(e) => update("last_name", e.target.value)}
            />
          </FormField>
          <FormField
            label="Date of birth"
            required
            htmlFor="np-dob"
            error={errors.date_of_birth}
          >
            <Input
              id="np-dob"
              type="date"
              value={form.date_of_birth ?? ""}
              onChange={(e) => update("date_of_birth", e.target.value)}
            />
          </FormField>
          <FormField
            label="Gender"
            required
            htmlFor="np-gender"
            error={errors.gender}
          >
            <Select
              id="np-gender"
              value={form.gender ?? ""}
              onChange={(e) => update("gender", e.target.value)}
            >
              <option value="">Select…</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="non_binary">Non-binary</option>
              <option value="other">Other</option>
              <option value="prefer_not_to_say">Prefer not to say</option>
            </Select>
          </FormField>
          <FormField label="NPI" htmlFor="np-npi">
            <Input
              id="np-npi"
              placeholder="10-digit national provider ID"
              value={form.npi ?? ""}
              onChange={(e) => update("npi", e.target.value)}
            />
          </FormField>
          <FormField label="Taxonomy code" htmlFor="np-taxonomy">
            <Input
              id="np-taxonomy"
              value={form.taxonomy_code ?? ""}
              onChange={(e) => update("taxonomy_code", e.target.value)}
            />
          </FormField>
          <FormField label="Languages spoken" htmlFor="np-languages">
            <Input
              id="np-languages"
              placeholder="English, Spanish…"
              value={form.languages_spoken ?? ""}
              onChange={(e) => update("languages_spoken", e.target.value)}
            />
          </FormField>
          <FormField
            label="SSN"
            htmlFor="np-ssn"
            hint="Stored encrypted at rest."
          >
            <Input
              id="np-ssn"
              autoComplete="off"
              value={form.ssn ?? ""}
              onChange={(e) => update("ssn", e.target.value)}
            />
          </FormField>
          <FormField label="Role" required htmlFor="np-role">
            <Select
              id="np-role"
              value={form.role}
              onChange={(e) => update("role", e.target.value as Role)}
            >
              <option value="provider">Provider</option>
              <option value="staff">Staff</option>
              <option value="admin">Admin</option>
            </Select>
          </FormField>
          <FormField
            label="Avatar URL"
            htmlFor="np-avatar"
            hint="Paste a hosted image URL. File upload coming soon."
          >
            <Input
              id="np-avatar"
              value={form.avatar_url ?? ""}
              onChange={(e) => update("avatar_url", e.target.value || null)}
            />
          </FormField>
        </Section>

        {/* ----------------------------- Contact ---------------------------- */}
        <Section title="Contact Details">
          <FormField label="Address line 1" htmlFor="np-addr1">
            <Input
              id="np-addr1"
              value={form.address_line1 ?? ""}
              onChange={(e) => update("address_line1", e.target.value)}
            />
          </FormField>
          <FormField label="Address line 2" htmlFor="np-addr2">
            <Input
              id="np-addr2"
              value={form.address_line2 ?? ""}
              onChange={(e) => update("address_line2", e.target.value)}
            />
          </FormField>
          <FormField label="City" htmlFor="np-city">
            <Input
              id="np-city"
              value={form.city ?? ""}
              onChange={(e) => update("city", e.target.value)}
            />
          </FormField>
          <FormField label="Zip code" htmlFor="np-zip">
            <Input
              id="np-zip"
              value={form.zip_code ?? ""}
              onChange={(e) => update("zip_code", e.target.value)}
            />
          </FormField>
          <FormField label="Telephone" htmlFor="np-tel">
            <Input
              id="np-tel"
              type="tel"
              value={form.telephone ?? ""}
              onChange={(e) => update("telephone", e.target.value)}
            />
          </FormField>
          <FormField label="Mobile" htmlFor="np-mobile">
            <Input
              id="np-mobile"
              type="tel"
              value={form.mobile ?? ""}
              onChange={(e) => update("mobile", e.target.value)}
            />
          </FormField>
          <FormField label="Fax" htmlFor="np-fax">
            <Input
              id="np-fax"
              value={form.fax ?? ""}
              onChange={(e) => update("fax", e.target.value)}
            />
          </FormField>
          <FormField
            label="Email"
            required
            htmlFor="np-email"
            error={errors.email}
          >
            <Input
              id="np-email"
              type="email"
              placeholder="jane@padmavat.health"
              value={form.email}
              onChange={(e) => update("email", e.target.value)}
            />
          </FormField>
          <FormField label="Time zone" htmlFor="np-tz">
            <Input
              id="np-tz"
              placeholder="America/Los_Angeles"
              value={form.time_zone ?? ""}
              onChange={(e) => update("time_zone", e.target.value)}
            />
          </FormField>
        </Section>

        {/* ------------------------------ Other ----------------------------- */}
        <Section title="Other Details">
          <FormField
            label="Federal tax ID"
            required
            htmlFor="np-ftid"
            hint="Stored encrypted at rest."
            error={errors.federal_tax_id}
          >
            <Input
              id="np-ftid"
              autoComplete="off"
              value={form.federal_tax_id ?? ""}
              onChange={(e) => update("federal_tax_id", e.target.value)}
            />
          </FormField>
          <FormField label="Tax ID type" htmlFor="np-tax-type">
            <Select
              id="np-tax-type"
              value={form.tax_id_type ?? ""}
              onChange={(e) => update("tax_id_type", e.target.value)}
            >
              <option value="">Select…</option>
              <option value="EIN">EIN</option>
              <option value="SSN">SSN</option>
              <option value="ITIN">ITIN</option>
            </Select>
          </FormField>
          <FormField label="Registration date" htmlFor="np-regdate">
            <Input
              id="np-regdate"
              type="date"
              value={form.registration_date ?? ""}
              onChange={(e) => update("registration_date", e.target.value)}
            />
          </FormField>
          <FormField label="Primary service location" htmlFor="np-loc">
            <Input
              id="np-loc"
              value={form.primary_service_location ?? ""}
              onChange={(e) =>
                update("primary_service_location", e.target.value)
              }
            />
          </FormField>
          <FormField label="Specialty" htmlFor="np-specialty">
            <Input
              id="np-specialty"
              placeholder="e.g. Orthopedics"
              value={form.specialty ?? ""}
              onChange={(e) => update("specialty", e.target.value || null)}
            />
          </FormField>
          <FormField
            label="Supervising provider"
            htmlFor="np-supervisor"
            hint={
              providerOptions.length === 0
                ? "No active providers to pick from yet."
                : undefined
            }
          >
            <Select
              id="np-supervisor"
              value={form.supervising_provider_id ?? ""}
              onChange={(e) =>
                update("supervising_provider_id", e.target.value || undefined)
              }
            >
              <option value="">None</option>
              {providerOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </Select>
          </FormField>
          <FormField label="Billing" htmlFor="np-nonbill">
            <label className="flex items-center gap-2 h-10 px-4 rounded-full border border-border bg-white shadow-soft text-sm cursor-pointer">
              <input
                id="np-nonbill"
                type="checkbox"
                className="size-4 accent-primary"
                checked={Boolean(form.is_non_billing)}
                onChange={(e) => update("is_non_billing", e.target.checked)}
              />
              Non-billing provider
            </label>
          </FormField>
        </Section>

        {/* --------------------------- Education ---------------------------- */}
        <RepeaterCard
          title="Education & Work Experience"
          onAdd={addEducationRow}
          emptyLabel="No education or work history added yet."
          rowCount={educationRows.length}
        >
          {educationRows.map((row, idx) => (
            <RepeaterRow
              key={`edu-${idx}`}
              onRemove={() => removeEducationRow(idx)}
            >
              <FormField label="Kind">
                <Select
                  value={row.kind}
                  onChange={(e) =>
                    updateEducationRow(
                      idx,
                      "kind",
                      e.target.value as ProviderEducationInput["kind"]
                    )
                  }
                >
                  <option value="education">Education</option>
                  <option value="work">Work</option>
                </Select>
              </FormField>
              <FormField label="Institution">
                <Input
                  value={row.institution}
                  onChange={(e) =>
                    updateEducationRow(idx, "institution", e.target.value)
                  }
                />
              </FormField>
              <FormField
                label={row.kind === "work" ? "Job title" : "Degree"}
              >
                <Input
                  value={row.title ?? ""}
                  onChange={(e) =>
                    updateEducationRow(idx, "title", e.target.value)
                  }
                />
              </FormField>
              <FormField label="Field or specialty">
                <Input
                  value={row.field_or_specialty ?? ""}
                  onChange={(e) =>
                    updateEducationRow(
                      idx,
                      "field_or_specialty",
                      e.target.value
                    )
                  }
                />
              </FormField>
              <FormField label="Start year">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={row.start_year ?? ""}
                  onChange={(e) =>
                    updateEducationRow(
                      idx,
                      "start_year",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                />
              </FormField>
              <FormField label="End year">
                <Input
                  type="number"
                  inputMode="numeric"
                  value={row.end_year ?? ""}
                  onChange={(e) =>
                    updateEducationRow(
                      idx,
                      "end_year",
                      e.target.value ? Number(e.target.value) : undefined
                    )
                  }
                />
              </FormField>
              <FormField label="Notes" className="md:col-span-2">
                <Textarea
                  rows={2}
                  value={row.notes ?? ""}
                  onChange={(e) =>
                    updateEducationRow(idx, "notes", e.target.value)
                  }
                />
              </FormField>
            </RepeaterRow>
          ))}
        </RepeaterCard>

        {/* ---------------------------- Licenses ---------------------------- */}
        <RepeaterCard
          title="Licensing and Compliance"
          onAdd={addLicenseRow}
          emptyLabel="No licenses added yet."
          rowCount={licenseRows.length}
        >
          {licenseRows.map((row, idx) => (
            <RepeaterRow
              key={`lic-${idx}`}
              onRemove={() => removeLicenseRow(idx)}
            >
              <FormField label="License type">
                <Input
                  value={row.license_type}
                  onChange={(e) =>
                    updateLicenseRow(idx, "license_type", e.target.value)
                  }
                />
              </FormField>
              <FormField label="License number">
                <Input
                  value={row.license_number}
                  onChange={(e) =>
                    updateLicenseRow(idx, "license_number", e.target.value)
                  }
                />
              </FormField>
              <FormField label="Issuing state">
                <Input
                  value={row.issuing_state ?? ""}
                  onChange={(e) =>
                    updateLicenseRow(idx, "issuing_state", e.target.value)
                  }
                />
              </FormField>
              <FormField label="Issuing authority">
                <Input
                  value={row.issuing_authority ?? ""}
                  onChange={(e) =>
                    updateLicenseRow(idx, "issuing_authority", e.target.value)
                  }
                />
              </FormField>
              <FormField label="Issued date">
                <Input
                  type="date"
                  value={row.issued_date ?? ""}
                  onChange={(e) =>
                    updateLicenseRow(idx, "issued_date", e.target.value)
                  }
                />
              </FormField>
              <FormField label="Expires date">
                <Input
                  type="date"
                  value={row.expires_date ?? ""}
                  onChange={(e) =>
                    updateLicenseRow(idx, "expires_date", e.target.value)
                  }
                />
              </FormField>
              <FormField label="Notes" className="md:col-span-2">
                <Textarea
                  rows={2}
                  value={row.notes ?? ""}
                  onChange={(e) =>
                    updateLicenseRow(idx, "notes", e.target.value)
                  }
                />
              </FormField>
            </RepeaterRow>
          ))}
        </RepeaterCard>
      </div>

      {/* Sticky save bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-border px-6 py-4 flex justify-end gap-3 z-30">
        <Button variant="ghost" onClick={cancel} disabled={submitting}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={submitting}>
          {submitting && <Loader2 className="size-4 animate-spin" />}
          {submitting ? "Saving…" : "Save provider"}
        </Button>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Section({
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
  // Memoise the empty hint so we don't trigger a re-render of the
  // whole card just because childCount didn't change.
  const isEmpty = useMemo(() => rowCount === 0, [rowCount]);

  return (
    <Card className="p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        <Button size="sm" variant="secondary" onClick={onAdd} type="button">
          <Plus className="size-3.5" /> Add row
        </Button>
      </div>
      {isEmpty && (
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
