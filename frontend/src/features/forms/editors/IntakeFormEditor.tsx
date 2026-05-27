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

  const setSection = <K extends keyof IntakeValue>(
    key: K,
    next: IntakeValue[K]
  ) => setValue((cur) => ({ ...cur, [key]: next }));

  const sections = useMemo<FormSection[]>(
    () => [
      {
        id: "demographics",
        label: "Demographics info",
        complete: isDemographicsComplete(value),
        render: () => (
          <DemographicsSection
            value={value.demographics}
            onChange={(v) => setSection("demographics", v)}
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
            onChange={(v) => setSection("contact", v)}
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
            onChange={(v) => setSection("insurance", v)}
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
            onChange={(v) => setSection("family_health_history", v)}
          />
        ),
      },
    ],
    [value]
  );

  const canSave = isDemographicsComplete(value);

  const handleSave = async () => {
    await submit.mutateAsync({ id: form.id, data: value });
    onClose();
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
  onChange,
}: {
  value: IntakeValue["demographics"];
  onChange: (v: IntakeValue["demographics"]) => void;
}) {
  const set = (k: keyof IntakeValue["demographics"], v: string) =>
    onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <FormField label="First name" required>
        <Input
          value={value.first_name}
          onChange={(e) => set("first_name", e.target.value)}
        />
      </FormField>
      <FormField label="Middle name">
        <Input
          value={value.middle_name}
          onChange={(e) => set("middle_name", e.target.value)}
        />
      </FormField>
      <FormField label="Last name" required>
        <Input
          value={value.last_name}
          onChange={(e) => set("last_name", e.target.value)}
        />
      </FormField>
      <FormField label="Suffix">
        <Select value={value.suffix} onChange={(v) => set("suffix", v)}>
          {SUFFIXES.map((s) => (
            <option key={s} value={s}>
              {s || "—"}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Nickname">
        <Input
          value={value.nickname}
          onChange={(e) => set("nickname", e.target.value)}
        />
      </FormField>
      <FormField label="Gender at birth">
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
      <FormField label="Current gender">
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
      <FormField label="Pronouns">
        <Select value={value.pronouns} onChange={(v) => set("pronouns", v)}>
          {PRONOUNS.map((p) => (
            <option key={p} value={p}>
              {p || "—"}
            </option>
          ))}
        </Select>
      </FormField>

      <FormField label="Date of birth" required>
        <Input
          type="date"
          value={value.dob}
          onChange={(e) => set("dob", e.target.value)}
        />
      </FormField>
      <FormField label="Marital status">
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
      <FormField label="Time zone">
        <Input
          value={value.time_zone}
          onChange={(e) => set("time_zone", e.target.value)}
          placeholder="e.g. America/Los_Angeles"
        />
      </FormField>
      <FormField label="Preferred language">
        <Input
          value={value.preferred_language}
          onChange={(e) => set("preferred_language", e.target.value)}
          placeholder="English"
        />
      </FormField>

      <FormField label="Occupation">
        <Input
          value={value.occupation}
          onChange={(e) => set("occupation", e.target.value)}
        />
      </FormField>
      <FormField label="SSN">
        <Input
          value={value.ssn}
          onChange={(e) => set("ssn", e.target.value)}
          placeholder="123-45-6789"
        />
      </FormField>
      <FormField label="Race">
        <Select value={value.race} onChange={(v) => set("race", v)}>
          {RACES.map((r) => (
            <option key={r} value={r}>
              {r || "—"}
            </option>
          ))}
        </Select>
      </FormField>
      <FormField label="Ethnicity">
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
  onChange,
}: {
  value: IntakeValue["contact"];
  onChange: (v: IntakeValue["contact"]) => void;
}) {
  const set = (k: keyof IntakeValue["contact"], v: string) =>
    onChange({ ...value, [k]: v });
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
      <FormField label="Mobile number">
        <Input
          value={value.mobile_number}
          onChange={(e) => set("mobile_number", e.target.value)}
        />
      </FormField>
      <FormField label="Home number">
        <Input
          value={value.home_number}
          onChange={(e) => set("home_number", e.target.value)}
        />
      </FormField>
      <FormField label="Email">
        <Input
          type="email"
          value={value.email}
          onChange={(e) => set("email", e.target.value)}
        />
      </FormField>
      <FormField label="Fax number">
        <Input
          value={value.fax_number}
          onChange={(e) => set("fax_number", e.target.value)}
        />
      </FormField>

      <div className="sm:col-span-2 lg:col-span-2">
        <FormField label="Address line 1">
          <Input
            value={value.address_line_1}
            onChange={(e) => set("address_line_1", e.target.value)}
          />
        </FormField>
      </div>
      <div className="sm:col-span-2 lg:col-span-2">
        <FormField label="Address line 2">
          <Input
            value={value.address_line_2}
            onChange={(e) => set("address_line_2", e.target.value)}
          />
        </FormField>
      </div>

      <FormField label="City">
        <Input
          value={value.city}
          onChange={(e) => set("city", e.target.value)}
        />
      </FormField>
      <FormField label="State">
        <Input
          value={value.state}
          onChange={(e) => set("state", e.target.value)}
        />
      </FormField>
      <FormField label="Country">
        <Input
          value={value.country}
          onChange={(e) => set("country", e.target.value)}
        />
      </FormField>
      <FormField label="Zip code">
        <Input
          value={value.zip_code}
          onChange={(e) => set("zip_code", e.target.value)}
        />
      </FormField>
    </div>
  );
}

function InsuranceSection({
  value,
  onChange,
}: {
  value: IntakeValue["insurance"];
  onChange: (v: IntakeValue["insurance"]) => void;
}) {
  const set = <K extends keyof IntakeValue["insurance"]>(
    k: K,
    v: IntakeValue["insurance"][K]
  ) => onChange({ ...value, [k]: v });
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <FormField label="Insurance name">
          <Input
            value={value.insurance_name}
            onChange={(e) => set("insurance_name", e.target.value)}
          />
        </FormField>
        <FormField label="Member ID">
          <Input
            value={value.member_id}
            onChange={(e) => set("member_id", e.target.value)}
          />
        </FormField>
        <FormField label="Insurance plan">
          <Input
            value={value.insurance_plan}
            onChange={(e) => set("insurance_plan", e.target.value)}
          />
        </FormField>
        <FormField label="Insured group name">
          <Input
            value={value.insured_group_name}
            onChange={(e) => set("insured_group_name", e.target.value)}
          />
        </FormField>

        <FormField label="Group number">
          <Input
            value={value.group_number}
            onChange={(e) => set("group_number", e.target.value)}
          />
        </FormField>
        <FormField label="Effective start date">
          <Input
            type="date"
            value={value.effective_start_date}
            onChange={(e) => set("effective_start_date", e.target.value)}
          />
        </FormField>
        <FormField label="Effective end date">
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
  onChange,
}: {
  value: IntakeValue["health_history"];
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
          onChange={(e) =>
            onChange({ ...value, diagnosed_problems: e.target.value })
          }
          rows={3}
          className="mt-2"
        />
      </div>

      <div>
        <Bullet label="Past surgeries and major hospitalizations:" />
        <div className="mt-2">
          <RepeatableList
            items={value.past_surgeries}
            newItem={() => ({ name: "", onset_date: "", hospital: "", note: "" })}
            onChange={(v) => onChange({ ...value, past_surgeries: v })}
            renderRow={(row, setRow) => (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
                <Input
                  placeholder="Surgery name"
                  value={row.name}
                  onChange={(e) => setRow({ ...row, name: e.target.value })}
                />
                <Input
                  type="date"
                  placeholder="Onset date"
                  value={row.onset_date}
                  onChange={(e) =>
                    setRow({ ...row, onset_date: e.target.value })
                  }
                />
                <Input
                  placeholder="Hospital name"
                  value={row.hospital}
                  onChange={(e) => setRow({ ...row, hospital: e.target.value })}
                />
                <Input
                  placeholder="Note"
                  value={row.note}
                  onChange={(e) => setRow({ ...row, note: e.target.value })}
                />
              </div>
            )}
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
            renderRow={(row, setRow) => (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <Input
                  placeholder="Medication name"
                  value={row.name}
                  onChange={(e) => setRow({ ...row, name: e.target.value })}
                />
                <Input
                  placeholder="Frequency"
                  value={row.frequency}
                  onChange={(e) =>
                    setRow({ ...row, frequency: e.target.value })
                  }
                />
                <Input
                  placeholder="Note"
                  value={row.note}
                  onChange={(e) => setRow({ ...row, note: e.target.value })}
                />
              </div>
            )}
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
            renderRow={(row, setRow) => (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
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
                <Input
                  placeholder="Allergy name"
                  value={row.name}
                  onChange={(e) => setRow({ ...row, name: e.target.value })}
                />
                <Input
                  placeholder="Description"
                  value={row.description}
                  onChange={(e) =>
                    setRow({ ...row, description: e.target.value })
                  }
                />
              </div>
            )}
          />
        </div>
      </div>
    </div>
  );
}

function FamilyHealthHistorySection({
  value,
  onChange,
}: {
  value: IntakeValue["family_health_history"];
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
          renderRow={(row, setRow) => (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              <Input
                placeholder="Condition name"
                value={row.condition_name}
                onChange={(e) =>
                  setRow({ ...row, condition_name: e.target.value })
                }
              />
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
              <Input
                type="date"
                placeholder="Onset date"
                value={row.onset_date}
                onChange={(e) =>
                  setRow({ ...row, onset_date: e.target.value })
                }
              />
              <Input
                placeholder="Note"
                value={row.note}
                onChange={(e) => setRow({ ...row, note: e.target.value })}
              />
            </div>
          )}
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
