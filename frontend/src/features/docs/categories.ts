import type { DocCategory } from "@/features/docs/api/docs-api";

/**
 * Category taxonomy + display strings. The backend stores `category`
 * as a free-form string; this file is the canonical UI list. Keeping
 * one source of truth avoids label drift between the upload modal,
 * filter chips, and detail cards.
 */
export const CATEGORY_LABEL: Record<DocCategory, string> = {
  consent: "Consent",
  lab: "Lab report",
  imaging: "Imaging",
  discharge: "Discharge",
  referral: "Referral",
  insurance: "Insurance",
  operative: "Operative",
  pathology: "Pathology",
  education: "Education",
  advance_directive: "Advance directive",
  other: "Other",
};

export const CATEGORY_TONE: Record<
  DocCategory,
  "info" | "warning" | "success" | "danger" | "neutral" | "primary"
> = {
  consent: "warning",
  lab: "info",
  imaging: "primary",
  discharge: "success",
  referral: "info",
  insurance: "neutral",
  operative: "danger",
  pathology: "danger",
  education: "success",
  advance_directive: "warning",
  other: "neutral",
};

export const CATEGORY_KEYS = Object.keys(CATEGORY_LABEL) as DocCategory[];

export function categoryLabel(c: string): string {
  return CATEGORY_LABEL[c as DocCategory] ?? c;
}
