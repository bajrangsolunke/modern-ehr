import type { FormStatus, FormType } from "./api/forms-api";

export const FORM_TYPES: FormType[] = [
  "consent",
  "intake",
  "roi",
  "insurance",
  "discharge",
  "referral",
];

export const FORM_TYPE_LABEL: Record<FormType, string> = {
  consent: "Consent",
  intake: "Intake",
  roi: "ROI",
  insurance: "Insurance",
  discharge: "Discharge",
  referral: "Referral",
};

export const FORM_TYPE_DESCRIPTION: Record<FormType, string> = {
  consent: "Patient consent for a procedure or treatment.",
  intake: "Initial intake — chief complaint, history, meds, allergies.",
  roi: "Release of Information — authorize sharing records.",
  insurance: "Insurance coverage + subscriber details.",
  discharge: "Discharge summary, instructions, and follow-up.",
  referral: "Referral to another provider or specialty.",
};

export const STATUSES: FormStatus[] = [
  "pending",
  "submitted",
  "completed",
  "denied",
];

export const STATUS_LABEL: Record<FormStatus, string> = {
  pending: "Pending",
  submitted: "Submitted",
  completed: "Completed",
  denied: "Denied",
};

export const STATUS_TONE: Record<FormStatus, string> = {
  pending: "bg-info/10 text-info",
  submitted: "bg-warning/10 text-warning",
  completed: "bg-success/10 text-success",
  denied: "bg-danger/10 text-danger",
};
