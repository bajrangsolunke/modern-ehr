/**
 * Per-form-type field definitions. The filler view reads these to
 * render inputs; the preview reads these to render labels in the same
 * order. Centralizing here means adding a field touches exactly one
 * place plus the matching backend Pydantic schema.
 */
import type { FormType } from "./api/forms-api";

export type FieldKind =
  | "text"
  | "textarea"
  | "date"
  | "checkbox"
  | "checkbox-group"
  | "radio";

export interface FormField {
  name: string;
  label: string;
  kind: FieldKind;
  required?: boolean;
  /** For checkbox-group / radio. */
  options?: Array<{ value: string; label: string }>;
  /** Optional helper text shown under the input. */
  hint?: string;
  /** Span the input across 2 columns on the default 2-col grid. */
  fullWidth?: boolean;
}

export interface FormDefinition {
  type: FormType;
  title: string;
  description: string;
  fields: FormField[];
}

const ROI_CATEGORIES = [
  { value: "medical_records", label: "Medical records" },
  { value: "billing", label: "Billing" },
  { value: "lab_results", label: "Lab results" },
  { value: "imaging", label: "Imaging" },
  { value: "clinical_notes", label: "Clinical notes" },
  { value: "discharge_summaries", label: "Discharge summaries" },
];

export const FORM_DEFINITIONS: Record<FormType, FormDefinition> = {
  consent: {
    type: "consent",
    title: "Consent form",
    description:
      "Acknowledge the procedure and authorize the clinical team to proceed.",
    fields: [
      {
        name: "procedure_name",
        label: "Procedure",
        kind: "text",
        required: true,
        fullWidth: true,
      },
      { name: "procedure_date", label: "Procedure date", kind: "date" },
      {
        name: "patient_signature",
        label: "Patient signature (typed)",
        kind: "text",
        required: true,
      },
      { name: "guardian_name", label: "Guardian name (if minor)", kind: "text" },
      {
        name: "consent_acknowledged",
        label: "I have read and consent to the procedure described above.",
        kind: "checkbox",
        required: true,
        fullWidth: true,
      },
      { name: "signed_date", label: "Date signed", kind: "date", required: true },
    ],
  },

  intake: {
    type: "intake",
    title: "Intake form",
    description:
      "Initial clinical context — chief complaint, current meds, allergies, history.",
    fields: [
      {
        name: "chief_complaint",
        label: "Chief complaint",
        kind: "textarea",
        required: true,
        fullWidth: true,
      },
      {
        name: "current_medications",
        label: "Current medications",
        kind: "textarea",
        fullWidth: true,
        hint: "One per line — name + dose + frequency.",
      },
      {
        name: "allergies",
        label: "Allergies",
        kind: "textarea",
        fullWidth: true,
        hint: "Drug, food, environmental — note severity.",
      },
      {
        name: "past_medical_history",
        label: "Past medical history",
        kind: "textarea",
        fullWidth: true,
      },
      {
        name: "family_history",
        label: "Family history",
        kind: "textarea",
        fullWidth: true,
      },
      {
        name: "visit_date",
        label: "Visit date",
        kind: "date",
        required: true,
      },
    ],
  },

  roi: {
    type: "roi",
    title: "Release of Information",
    description:
      "Authorize the release of specific records to a named party.",
    fields: [
      {
        name: "releasing_to",
        label: "Releasing to (name)",
        kind: "text",
        required: true,
      },
      {
        name: "relationship",
        label: "Relationship",
        kind: "text",
        required: true,
        hint: "e.g. attorney, family member, insurance.",
      },
      {
        name: "info_categories",
        label: "Information to release",
        kind: "checkbox-group",
        required: true,
        fullWidth: true,
        options: ROI_CATEGORIES,
      },
      { name: "valid_until", label: "Valid until", kind: "date", required: true },
      {
        name: "patient_signature",
        label: "Patient signature (typed)",
        kind: "text",
        required: true,
      },
      { name: "signed_date", label: "Date signed", kind: "date", required: true },
    ],
  },

  insurance: {
    type: "insurance",
    title: "Insurance form",
    description: "Coverage and subscriber details for billing.",
    fields: [
      { name: "provider", label: "Insurance provider", kind: "text", required: true },
      { name: "policy_number", label: "Policy number", kind: "text", required: true },
      { name: "group_number", label: "Group number", kind: "text" },
      {
        name: "subscriber_name",
        label: "Subscriber name",
        kind: "text",
        required: true,
      },
      { name: "subscriber_dob", label: "Subscriber DOB", kind: "date", required: true },
      {
        name: "relationship_to_patient",
        label: "Relationship to patient",
        kind: "text",
        required: true,
        hint: "e.g. self, spouse, parent.",
      },
      { name: "effective_date", label: "Effective date", kind: "date", required: true },
    ],
  },

  discharge: {
    type: "discharge",
    title: "Discharge form",
    description: "Diagnoses, instructions, follow-up, and meds at discharge.",
    fields: [
      {
        name: "discharge_diagnosis",
        label: "Discharge diagnosis",
        kind: "textarea",
        required: true,
        fullWidth: true,
      },
      { name: "discharge_date", label: "Discharge date", kind: "date", required: true },
      {
        name: "instructions",
        label: "Discharge instructions",
        kind: "textarea",
        required: true,
        fullWidth: true,
      },
      {
        name: "follow_up",
        label: "Follow-up plan",
        kind: "textarea",
        fullWidth: true,
      },
      {
        name: "medications_at_discharge",
        label: "Medications at discharge",
        kind: "textarea",
        fullWidth: true,
      },
      {
        name: "restrictions",
        label: "Activity restrictions",
        kind: "textarea",
        fullWidth: true,
      },
    ],
  },

  referral: {
    type: "referral",
    title: "Referral form",
    description: "Refer the patient to another provider or specialty.",
    fields: [
      {
        name: "referring_to_provider",
        label: "Referring to (provider name)",
        kind: "text",
        required: true,
      },
      { name: "specialty", label: "Specialty", kind: "text", required: true },
      {
        name: "reason",
        label: "Reason for referral",
        kind: "textarea",
        required: true,
        fullWidth: true,
      },
      {
        name: "urgency",
        label: "Urgency",
        kind: "radio",
        required: true,
        options: [
          { value: "routine", label: "Routine" },
          { value: "urgent", label: "Urgent" },
          { value: "stat", label: "STAT" },
        ],
      },
      {
        name: "relevant_history",
        label: "Relevant history",
        kind: "textarea",
        fullWidth: true,
      },
      { name: "referral_date", label: "Referral date", kind: "date", required: true },
    ],
  },
};
