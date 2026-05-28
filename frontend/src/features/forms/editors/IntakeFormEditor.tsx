/**
 * Patient intake form editor — sectioned, accordion-based.
 * Mirrors the backend IntakeFormPayload shape exactly.
 *
 * Sections:
 *   1. Demographics
 *   2. Contact
 *   3. Insurance
 *   4. Patient Health History
 *   5. Family Health History
 *
 * Each section's "complete" flag lights the sidebar green when its
 * required fields are filled. The data shape is JSON-safe at every
 * point so it round-trips through the JSONB column unchanged.
 *
 * Validation: client-side rules mirror the backend Pydantic schema
 * (intake-validation.ts). Inputs hard-cap typing via maxLength so
 * users can't even produce most "too long" cases; the validator runs
 * on save and a backend 422 is mapped back into the same inline error
 * tree so users always see *which* field failed and why.
 */
import { useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormField } from "@/components/ui/form";
import { Select } from "./shared/Select";
import { FormShell, type FormSection } from "./shared/FormShell";
import { RepeatableList } from "./shared/RepeatableList";
import { ImageUpload } from "./shared/ImageUpload";
import { useSubmitForm } from "../hooks/use-forms";
import type { FormRequest } from "../api/forms-api";
import {
  INTAKE_LIMITS,
  emptyIntakeErrors,
  validateIntake,
  hasIntakeErrors,
  firstSectionWithError,
  extractBackendErrors,
  mapBackendErrorsToIntake,
  type IntakeErrors,
} from "./intake-validation";

/* -------------------------------------------------------------------------- */
/* Vocabulary                                                                 */
/* -------------------------------------------------------------------------- */

const SUFFIXES = ["", "Jr.", "Sr.", "II", "III", "IV"];
const GENDERS = ["", "Female", "Male", "Other", "Prefer not to say"];
const PRONOUNS = ["", "she/her", "he/him", "they/them", "other"];
const MARITAL = ["", "Single", "Married", "Divorced", "Widowed", "Separated"];
const RACES = [
  "",
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Hispanic or Latino",
  "Other",
];
const ETHNICITY = ["", "Hispanic or Latino", "Not Hispanic or Latino"];

const CHILDHOOD_ILLNESSES = [
  "Measles",
  "Mumps",
  "Rubella",
  "Chicken Pox",
  "Rheumatic Fever",
  "Polio",
];

const ALLERGY_TYPES = ["", "Drug", "Food", "Environmental", "Other"];
const RELATIONS = [
  "",
  "Mother",
  "Father",
  "Sibling",
  "Maternal grandparent",
  "Paternal grandparent",
  "Other",
];

const TODAY = new Date().toISOString().slice(0, 10);

/* -------------------------------------------------------------------------- */
/* Default value                                                              */
/* -------------------------------------------------------------------------- */

function emptyValue() {
  return {
    demographics: {
      first_name: "",
      middle_name: "",
      last_name: "",
      suffix: "",
      nickname: "",
      gender_at_birth: "",
      current_gender: "",
      pronouns: "",
      dob: "",
      marital_status: "",
      time_zone: "",
      preferred_language: "",
      occupation: "",
      ssn: "",
      race: "",
      ethnicity: "",
    },
    contact: {
      mobile_number: "",
      home_number: "",
      email: "",
      fax_number: "",
      address_line_1: "",
      address_line_2: "",
      city: "",
      state: "",
      country: "",
      zip_code: "",
    },
    insurance: {
      insurance_name: "",
      member_id: "",
      insurance_plan: "",
      insured_group_name: "",
      group_number: "",
      effective_start_date: "",
      effective_end_date: "",
      card_front_url: null as string | null,
      card_back_url: null as string | null,
    },
    health_history: {
      childhood_illnesses: [] as string[],
      diagnosed_problems: "",
      past_surgeries: [] as Array<{
        name: string;
        onset_date: string;
        hospital: string;
        note: string;
      }>,
      current_medications: [] as Array<{
        name: string;
        frequency: string;
        note: string;
      }>,
      allergies: [] as Array<{
        type: string;
        name: string;
        description: string;
      }>,
    },
    family_health_history: {
      conditions: [] as Array<{
        condition_name: string;
        relation: string;
        onset_date: string;
        note: string;
      }>,
    },
  };
}

type IntakeValue = ReturnType<typeof emptyValue>;

/* -------------------------------------------------------------------------- */
/* Editor                                                                     */
/* -------------------------------------------------------------------------- */

interface Props {
  form: FormRequest;
  onClose: () => void;
}

export function IntakeFormEditor({ form, onClose }: Props) {
  const submit = useSubmitForm();

  // Start from existing data when re-editing; otherwise empty. We
  // deep-merge so partial saves round-trip cleanly.
  const [value, setValue] = useState<IntakeValue>(() => {
    const base = emptyValue();
    const existing = (form.data ?? {}) as Partial<IntakeValue>;
    return {
      ...base,
      ...existing,
      demographics: { ...base.demographics, ...(existing.demographics ?? {}) },
      contact: { ...base.contact, ...(existing.contact ?? {}) },
      insurance: { ...base.insurance, ...(existing.insurance ?? {}) },
      health_history: {
        ...base.health_history,
        ...(existing.health_history ?? {}),
      },
      family_health_history: {
        ...base.family_health_history,
        ...(existing.family_health_history ?? {}),
      },
    };
  });

  const [errors, setErrors] = useState<IntakeErrors>(emptyIntakeErrors);
  const [showErrors, setShowErrors] = useState(false);

  const setSection = <K extends keyof IntakeValue>(
    key: K,
    next: IntakeValue[K]
  ) => setValue((cur) => ({ ...cur, [key]: next }));

  // Clear a single demographic/contact/insurance field error when the
  // user edits that field — keeps the inline message from sticking
  // after they've fixed it.
  const clearFieldError = (
    section: "demographics" | "contact" | "insurance",
    field: string
  ) => {
    setErrors((cur) => {
      const sectionErrors = cur[section] as Record<string, string | undefined>;
      if (!(field in sectionErrors)) return cur;
      const { [field]: _, ...rest } = sectionErrors;
      return { ...cur, [section]: rest } as IntakeErrors;
    });
  };

  const sections = useMemo<FormSection[]>(
    () => [
      {
        id: "demographics",
        label: "Demographics info",
        complete: isDemographicsComplete(value),
        render: () => (
          <DemographicsSection
            value={value.demographics}
            errors={showErrors ? errors.demographics : {}}
            onChange={(v, changedField) => {
              setSection("demographics", v);
              if (changedField) clearFieldError("demographics", changedField);
            }}
          />
        ),
      },
      {
        id: "contact",
        label: "Contact info",
        complete: isContactComplete(value),
        render: () => (
          <ContactSection
            value={value.contact}
            errors={showErrors ? errors.contact : {}}
            onChange={(v, changedField) => {
              setSection("contact", v);
              if (changedField) clearFieldError("contact", changedField);
            }}
          />
        ),
      },
      {
        id: "insurance",
        label: "Insurance info",
        complete: isInsuranceComplete(value),
        render: () => (
          <InsuranceSection
            value={value.insurance}
            errors={showErrors ? errors.insurance : {}}
            onChange={(v, changedField) => {
              setSection("insurance", v);
              if (changedField) clearFieldError("insurance", changedField);
            }}
          />
        ),
      },
      {
        id: "health",
        label: "Patient health history",
        complete: isHealthComplete(value),
        render: () => (
          <HealthHistorySection
            value={value.health_history}
            errors={showErrors ? errors.health_history : emptyIntakeErrors().health_history}
            onChange={(v) => setSection("health_history", v)}
          />
        ),
      },
      {
        id: "family",
        label: "Family health history",
        complete: isFamilyComplete(value),
        render: () => (
          <FamilyHealthHistorySection
            value={value.family_health_history}
            errors={
              showErrors
                ? errors.family_health_history
                : emptyIntakeErrors().family_health_history
            }
            onChange={(v) => setSection("family_health_history", v)}
          />
        ),
      },
    ],
    [value, errors, showErrors]
  );

  const canSave = isDemographicsComplete(value);

  const handleSave = async () => {
    const validation = validateIntake(value);
    setErrors(validation);
    if (hasIntakeErrors(validation)) {
      setShowErrors(true);
      const sectionId = firstSectionWithError(validation);
      if (sectionId) {
        // Defer so the section is mounted before we scroll.
        requestAnimationFrame(() => {
          document
            .getElementById(`section-${sectionId}`)
            ?.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
      return;
    }
    try {
      await submit.mutateAsync({ id: form.id, data: value });
      onClose();
    } catch (err) {
      // Map any backend-side errors we didn't catch into the same
      // inline tree so the user can see exactly which field failed.
      const beErrors = extractBackendErrors(err);
      if (beErrors.length) {
        setErrors((cur) => mapBackendErrorsToIntake(beErrors, cur));
        setShowErrors(true);
        const sectionId = firstSectionWithError(
          mapBackendErrorsToIntake(beErrors, validation)
        );
        if (sectionId) {
          requestAnimationFrame(() => {
            document
              .getElementById(`section-${sectionId}`)
              ?.scrollIntoView({ behavior: "smooth", block: "start" });
          });
        }
      }
    }
  };

  return (
    <FormShell
      title="Patient intake form"
      sections={sections}
      onBack={onClose}
      onCancel={onClose}
      onSave={handleSave}
      saving={submit.isPending}
      canSave={canSave}
    />
  );
}

/* -------------------------------------------------------------------------- */
/* Section components                                                         */
/* -------------------------------------------------------------------------- */

function DemographicsSection({
  value,
  errors,
  onChange,
}: {
  value: IntakeValue["demographics"];
  errors: IntakeErrors["demographics"];
  onChange: (v: IntakeValue["demographics"], changedField?: string) => void;
}) {
  const set = (k: keyof IntakeValue["demographics"], v: string) =>
    onChange({ ...value, [k]: v }, k);
  const L = INTAKE_LIMITS.demographics;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <FormField label="First name" required error={errors.first_name}>
        <Input
          value={value.first_name}
          maxLength={L.first_name}
          onChange={(e) => set("first_name", e.target.value)}
        />
      </FormField>
      <FormField label="Middle name" error={errors.middle_name}>
        <Input
          value={value.middle_name}
          maxLength={L.middle_name}
          onChange={(e) => set("middle_name", e.target.value)}
        />
      </FormField>
      <FormField label="Last name" required error={errors.last_name}>
        <Input
          value={value.last_name}
          maxLength={L.last_name}
          onChange={(e) => set("last_name", e.target.value)}
        />
      </FormField>
      <FormField label="Suffix" error={errors.suffix}>
        <Select value={value.suffix} onChange={(v) => set("suffix", v)}>
          {SUFFIXES.map((s) => (
            <option key={s} value={s}>
              {s || "—"}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Nickname" error={errors.nickname}>
        <Input
          value={value.nickname}
          maxLength={L.nickname}
          onChange={(e) => set("nickname", e.target.value)}
        />
      </FormField>
      <FormField label="Gender at birth" error={errors.gender_at_birth}>
        <Select
          value={value.gender_at_birth}
          onChange={(v) => set("gender_at_birth", v)}
        >
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {g || "—"}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Current gender" error={errors.current_gender}>
        <Select
          value={value.current_gender}
          onChange={(v) => set("current_gender", v)}
        >
          {GENDERS.map((g) => (
            <option key={g} value={g}>
              {g || "—"}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Pronouns" error={errors.pronouns}>
        <Select value={value.pronouns} onChange={(v) => set("pronouns", v)}>
          {PRONOUNS.map((p) => (
            <option key={p} value={p}>
              {p || "—"}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Date of birth" required error={errors.dob}>
        <Input
          type="date"
          value={value.dob}
          max={TODAY}
          onChange={(e) => set("dob", e.target.value)}
        />
      </FormField>
      <FormField label="Marital status" error={errors.marital_status}>
        <Select
          value={value.marital_status}
          onChange={(v) => set("marital_status", v)}
        >
          {MARITAL.map((m) => (
            <option key={m} value={m}>
              {m || "—"}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Time zone" error={errors.time_zone}>
        <Input
          value={value.time_zone}
          maxLength={L.time_zone}
          onChange={(e) => set("time_zone", e.target.value)}
          placeholder="e.g. America/Los_Angeles"
        />
      </FormField>
      <FormField label="Preferred language" error={errors.preferred_language}>
        <Input
          value={value.preferred_language}
          maxLength={L.preferred_language}
          onChange={(e) => set("preferred_language", e.target.value)}
          placeholder="English"
        />
      </FormField>

      <FormField label="Occupation" error={errors.occupation}>
        <Input
          value={value.occupation}
          maxLength={L.occupation}
          onChange={(e) => set("occupation", e.target.value)}
        />
      </FormField>
      <FormField label="SSN" error={errors.ssn}>
        <Input
          value={value.ssn}
          maxLength={L.ssn}
          onChange={(e) => set("ssn", e.target.value)}
          placeholder="123-45-6789"
        />
      </FormField>
      <FormField label="Race" error={errors.race}>
        <Select value={value.race} onChange={(v) => set("race", v)}>
          {RACES.map((r) => (
            <option key={r} value={r}>
              {r || "—"}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Ethnicity" error={errors.ethnicity}>
        <Select value={value.ethnicity} onChange={(v) => set("ethnicity", v)}>
          {ETHNICITY.map((e) => (
            <option key={e} value={e}>
              {e || "—"}
            </option>
          ))}
        </Select>
      </FormField>
    </div>
  );
}

function ContactSection({
  value,
  errors,
  onChange,
}: {
  value: IntakeValue["contact"];
  errors: IntakeErrors["contact"];
  onChange: (v: IntakeValue["contact"], changedField?: string) => void;
}) {
  const set = (k: keyof IntakeValue["contact"], v: string) =>
    onChange({ ...value, [k]: v }, k);
  const L = INTAKE_LIMITS.contact;
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <FormField label="Mobile number" error={errors.mobile_number}>
        <Input
          value={value.mobile_number}
          maxLength={L.mobile_number}
          onChange={(e) => set("mobile_number", e.target.value)}
        />
      </FormField>
      <FormField label="Home number" error={errors.home_number}>
        <Input
          value={value.home_number}
          maxLength={L.home_number}
          onChange={(e) => set("home_number", e.target.value)}
        />
      </FormField>
      <FormField label="Email" error={errors.email}>
        <Input
          type="email"
          value={value.email}
          maxLength={L.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </FormField>
      <FormField label="Fax number" error={errors.fax_number}>
        <Input
          value={value.fax_number}
          maxLength={L.fax_number}
          onChange={(e) => set("fax_number", e.target.value)}
        />
      </FormField>

      <div className="sm:col-span-2 lg:col-span-2">
        <FormField label="Address line 1" error={errors.address_line_1}>
          <Input
            value={value.address_line_1}
            maxLength={L.address_line_1}
            onChange={(e) => set("address_line_1", e.target.value)}
          />
        </FormField>
      </div>
      <div className="sm:col-span-2 lg:col-span-2">
        <FormField label="Address line 2" error={errors.address_line_2}>
          <Input
            value={value.address_line_2}
            maxLength={L.address_line_2}
            onChange={(e) => set("address_line_2", e.target.value)}
          />
        </FormField>
      </div>

      <FormField label="City" error={errors.city}>
        <Input
          value={value.city}
          maxLength={L.city}
          onChange={(e) => set("city", e.target.value)}
        />
      </FormField>
      <FormField label="State" error={errors.state}>
        <Input
          value={value.state}
          maxLength={L.state}
          onChange={(e) => set("state", e.target.value)}
        />
      </FormField>
      <FormField label="Country" error={errors.country}>
        <Input
          value={value.country}
          maxLength={L.country}
          onChange={(e) => set("country", e.target.value)}
        />
      </FormField>
      <FormField label="Zip code" error={errors.zip_code}>
        <Input
          value={value.zip_code}
          maxLength={L.zip_code}
          onChange={(e) => set("zip_code", e.target.value)}
        />
      </FormField>
    </div>
  );
}

function InsuranceSection({
  value,
  errors,
  onChange,
}: {
  value: IntakeValue["insurance"];
  errors: IntakeErrors["insurance"];
  onChange: (v: IntakeValue["insurance"], changedField?: string) => void;
}) {
  const set = <K extends keyof IntakeValue["insurance"]>(
    k: K,
    v: IntakeValue["insurance"][K]
  ) => onChange({ ...value, [k]: v }, k as string);
  const L = INTAKE_LIMITS.insurance;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <FormField label="Insurance name" error={errors.insurance_name}>
          <Input
            value={value.insurance_name}
            maxLength={L.insurance_name}
            onChange={(e) => set("insurance_name", e.target.value)}
          />
        </FormField>
        <FormField label="Member ID" error={errors.member_id}>
          <Input
            value={value.member_id}
            maxLength={L.member_id}
            onChange={(e) => set("member_id", e.target.value)}
          />
        </FormField>
        <FormField label="Insurance plan" error={errors.insurance_plan}>
          <Input
            value={value.insurance_plan}
            maxLength={L.insurance_plan}
            onChange={(e) => set("insurance_plan", e.target.value)}
          />
        </FormField>
        <FormField label="Insured group name" error={errors.insured_group_name}>
          <Input
            value={value.insured_group_name}
            maxLength={L.insured_group_name}
            onChange={(e) => set("insured_group_name", e.target.value)}
          />
        </FormField>

        <FormField label="Group number" error={errors.group_number}>
          <Input
            value={value.group_number}
            maxLength={L.group_number}
            onChange={(e) => set("group_number", e.target.value)}
          />
        </FormField>
        <FormField label="Effective start date" error={errors.effective_start_date}>
          <Input
            type="date"
            value={value.effective_start_date}
            onChange={(e) => set("effective_start_date", e.target.value)}
          />
        </FormField>
        <FormField label="Effective end date" error={errors.effective_end_date}>
          <Input
            type="date"
            value={value.effective_end_date}
            onChange={(e) => set("effective_end_date", e.target.value)}
          />
        </FormField>
      </div>

      <div className="flex flex-wrap gap-6">
        <ImageUpload
          label="Insurance card front side"
          value={value.card_front_url}
          onChange={(v) => set("card_front_url", v)}
        />
        <ImageUpload
          label="Insurance card back side"
          value={value.card_back_url}
          onChange={(v) => set("card_back_url", v)}
        />
      </div>
    </div>
  );
}

function HealthHistorySection({
  value,
  errors,
  onChange,
}: {
  value: IntakeValue["health_history"];
  errors: IntakeErrors["health_history"];
  onChange: (v: IntakeValue["health_history"]) => void;
}) {
  const toggleIllness = (illness: string) => {
    const has = value.childhood_illnesses.includes(illness);
    onChange({
      ...value,
      childhood_illnesses: has
        ? value.childhood_illnesses.filter((i) => i !== illness)
        : [...value.childhood_illnesses, illness],
    });
  };

  return (
    <div className="space-y-5">
      <div>
        <Bullet label="Childhood illness" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 mt-2">
          {CHILDHOOD_ILLNESSES.map((illness) => {
            const checked = value.childhood_illnesses.includes(illness);
            return (
              <label
                key={illness}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => toggleIllness(illness)}
                  className="size-4 rounded border-border"
                />
                <span className="text-sm">{illness}</span>
              </label>
            );
          })}
        </div>
      </div>

      <div>
        <Bullet label="List any medical problems that other doctors have diagnosed:" />
        <Textarea
          value={value.diagnosed_problems}
          maxLength={INTAKE_LIMITS.diagnosed_problems}
          onChange={(e) =>
            onChange({ ...value, diagnosed_problems: e.target.value })
          }
          rows={3}
          className="mt-2"
        />
        {errors.diagnosed_problems && (
          <p className="text-xs text-danger leading-tight mt-1">
            {errors.diagnosed_problems}
          </p>
        )}
      </div>

      <div>
        <Bullet label="Past surgeries and major hospitalizations:" />
        <div className="mt-2">
          <RepeatableList
            items={value.past_surgeries}
            newItem={() => ({ name: "", onset_date: "", hospital: "", note: "" })}
            onChange={(v) => onChange({ ...value, past_surgeries: v })}
            renderRow={(row, setRow, idx) => {
              const rowErr = errors.past_surgeries[idx] ?? {};
              return (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                  <FieldWithError error={rowErr.name}>
                    <Input
                      placeholder="Surgery name"
                      value={row.name}
                      maxLength={INTAKE_LIMITS.past_surgery.name}
                      onChange={(e) => setRow({ ...row, name: e.target.value })}
                    />
                  </FieldWithError>
                  <FieldWithError error={rowErr.onset_date}>
                    <Input
                      type="date"
                      placeholder="Onset date"
                      value={row.onset_date}
                      onChange={(e) =>
                        setRow({ ...row, onset_date: e.target.value })
                      }
                    />
                  </FieldWithError>
                  <FieldWithError error={rowErr.hospital}>
                    <Input
                      placeholder="Hospital name"
                      value={row.hospital}
                      maxLength={INTAKE_LIMITS.past_surgery.hospital}
                      onChange={(e) =>
                        setRow({ ...row, hospital: e.target.value })
                      }
                    />
                  </FieldWithError>
                  <FieldWithError error={rowErr.note}>
                    <Input
                      placeholder="Note"
                      value={row.note}
                      maxLength={INTAKE_LIMITS.past_surgery.note}
                      onChange={(e) => setRow({ ...row, note: e.target.value })}
                    />
                  </FieldWithError>
                </div>
              );
            }}
          />
        </div>
      </div>

      <div>
        <Bullet label="Current medication" />
        <p className="text-xs text-muted-foreground italic mt-0.5">
          (List your prescribed drugs and over-the-counter drugs, such as
          vitamins and inhalers)
        </p>
        <div className="mt-2">
          <RepeatableList
            items={value.current_medications}
            newItem={() => ({ name: "", frequency: "", note: "" })}
            onChange={(v) => onChange({ ...value, current_medications: v })}
            renderRow={(row, setRow, idx) => {
              const rowErr = errors.current_medications[idx] ?? {};
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <FieldWithError error={rowErr.name}>
                    <Input
                      placeholder="Medication name"
                      value={row.name}
                      maxLength={INTAKE_LIMITS.current_medication.name}
                      onChange={(e) => setRow({ ...row, name: e.target.value })}
                    />
                  </FieldWithError>
                  <FieldWithError error={rowErr.frequency}>
                    <Input
                      placeholder="Frequency"
                      value={row.frequency}
                      maxLength={INTAKE_LIMITS.current_medication.frequency}
                      onChange={(e) =>
                        setRow({ ...row, frequency: e.target.value })
                      }
                    />
                  </FieldWithError>
                  <FieldWithError error={rowErr.note}>
                    <Input
                      placeholder="Note"
                      value={row.note}
                      maxLength={INTAKE_LIMITS.current_medication.note}
                      onChange={(e) => setRow({ ...row, note: e.target.value })}
                    />
                  </FieldWithError>
                </div>
              );
            }}
          />
        </div>
      </div>

      <div>
        <Bullet label="Allergies" />
        <div className="mt-2">
          <RepeatableList
            items={value.allergies}
            newItem={() => ({ type: "", name: "", description: "" })}
            onChange={(v) => onChange({ ...value, allergies: v })}
            renderRow={(row, setRow, idx) => {
              const rowErr = errors.allergies[idx] ?? {};
              return (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <FieldWithError error={rowErr.type}>
                    <Select
                      value={row.type}
                      onChange={(v) => setRow({ ...row, type: v })}
                    >
                      {ALLERGY_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t || "Allergy type"}
                        </option>
                      ))}
                    </Select>
                  </FieldWithError>
                  <FieldWithError error={rowErr.name}>
                    <Input
                      placeholder="Allergy name"
                      value={row.name}
                      maxLength={INTAKE_LIMITS.allergy.name}
                      onChange={(e) => setRow({ ...row, name: e.target.value })}
                    />
                  </FieldWithError>
                  <FieldWithError error={rowErr.description}>
                    <Input
                      placeholder="Description"
                      value={row.description}
                      maxLength={INTAKE_LIMITS.allergy.description}
                      onChange={(e) =>
                        setRow({ ...row, description: e.target.value })
                      }
                    />
                  </FieldWithError>
                </div>
              );
            }}
          />
        </div>
      </div>
    </div>
  );
}

function FamilyHealthHistorySection({
  value,
  errors,
  onChange,
}: {
  value: IntakeValue["family_health_history"];
  errors: IntakeErrors["family_health_history"];
  onChange: (v: IntakeValue["family_health_history"]) => void;
}) {
  return (
    <div>
      <Bullet label="Family conditions:" />
      <div className="mt-2">
        <RepeatableList
          items={value.conditions}
          newItem={() => ({
            condition_name: "",
            relation: "",
            onset_date: "",
            note: "",
          })}
          onChange={(v) => onChange({ ...value, conditions: v })}
          renderRow={(row, setRow, idx) => {
            const rowErr = errors.conditions[idx] ?? {};
            return (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <FieldWithError error={rowErr.condition_name}>
                  <Input
                    placeholder="Condition name"
                    value={row.condition_name}
                    maxLength={INTAKE_LIMITS.family_condition.condition_name}
                    onChange={(e) =>
                      setRow({ ...row, condition_name: e.target.value })
                    }
                  />
                </FieldWithError>
                <FieldWithError error={rowErr.relation}>
                  <Select
                    value={row.relation}
                    onChange={(v) => setRow({ ...row, relation: v })}
                  >
                    {RELATIONS.map((r) => (
                      <option key={r} value={r}>
                        {r || "Relation with patient"}
                      </option>
                    ))}
                  </Select>
                </FieldWithError>
                <FieldWithError error={rowErr.onset_date}>
                  <Input
                    type="date"
                    placeholder="Onset date"
                    value={row.onset_date}
                    onChange={(e) =>
                      setRow({ ...row, onset_date: e.target.value })
                    }
                  />
                </FieldWithError>
                <FieldWithError error={rowErr.note}>
                  <Input
                    placeholder="Note"
                    value={row.note}
                    maxLength={INTAKE_LIMITS.family_condition.note}
                    onChange={(e) => setRow({ ...row, note: e.target.value })}
                  />
                </FieldWithError>
              </div>
            );
          }}
        />
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Bullet({ label }: { label: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="size-1.5 rounded-full bg-foreground inline-block" />
      <span className="text-sm font-medium">{label}</span>
    </div>
  );
}

/** Tiny wrapper for repeatable-row inputs: renders the input plus a
 *  red helper line if there's an error. We don't use FormField here
 *  because rows have no per-cell labels — only the placeholder. */
function FieldWithError({
  error,
  children,
}: {
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      {children}
      {error && <p className="text-xs text-danger leading-tight">{error}</p>}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Completion predicates                                                      */
/* -------------------------------------------------------------------------- */

function isDemographicsComplete(v: IntakeValue): boolean {
  const d = v.demographics;
  return Boolean(d.first_name && d.last_name && d.dob);
}

function isContactComplete(v: IntakeValue): boolean {
  const c = v.contact;
  return Boolean(c.mobile_number || c.email);
}

function isInsuranceComplete(v: IntakeValue): boolean {
  const i = v.insurance;
  return Boolean(i.insurance_name && i.member_id);
}

function isHealthComplete(v: IntakeValue): boolean {
  const h = v.health_history;
  return (
    h.childhood_illnesses.length > 0 ||
    Boolean(h.diagnosed_problems) ||
    h.past_surgeries.length > 0 ||
    h.current_medications.length > 0 ||
    h.allergies.length > 0
  );
}

function isFamilyComplete(v: IntakeValue): boolean {
  return v.family_health_history.conditions.length > 0;
}
