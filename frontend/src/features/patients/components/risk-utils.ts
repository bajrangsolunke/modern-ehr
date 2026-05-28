import type { RiskLevel } from "../api/ai-api";

export const RISK_LEVEL_TONE: Record<RiskLevel, string> = {
  low: "bg-success/10 text-success",
  moderate: "bg-warning/10 text-warning",
  high: "bg-danger/10 text-danger",
  critical: "bg-danger/15 text-danger",
};

export const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
};
