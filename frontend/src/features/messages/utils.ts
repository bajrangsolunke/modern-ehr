import type { ConditionTag } from "./types";

export const CONDITION_LABEL: Record<ConditionTag, string> = {
  diabetic: "Diabetic",
  asthma: "Asthma",
  cancer: "Cancer",
  bp: "BP",
  mental: "Mental",
};

export const CONDITION_TONE: Record<ConditionTag, string> = {
  diabetic: "bg-info/10 text-info",
  asthma: "bg-success/10 text-success",
  cancer: "bg-danger/10 text-danger",
  bp: "bg-warning/10 text-warning",
  mental: "bg-primary/10 text-primary",
};

export function conditionLabel(c: ConditionTag): string {
  return CONDITION_LABEL[c];
}

export function conditionTone(c: ConditionTag): string {
  return CONDITION_TONE[c];
}
