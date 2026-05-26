/**
 * Metric metadata — labels, default units, and normal ranges used to
 * derive a status badge on each tile. Adult ranges; clinical override
 * happens upstream. Keep keys in sync with backend VitalMetric enum.
 */

export type VitalMetricKey =
  | "heart_rate"
  | "systolic_bp"
  | "diastolic_bp"
  | "temperature_c"
  | "spo2"
  | "respiratory_rate"
  | "weight_kg"
  | "height_cm"
  | "bmi"
  | "pain";

export type VitalStatus = "normal" | "low" | "elevated" | "critical";

export interface VitalMetricMeta {
  key: VitalMetricKey;
  label: string;
  short: string;
  defaultUnit: string;
  /** Normal range [low, high] — anything outside is "elevated" or "low". */
  normal?: [number, number];
  /** Anything <= criticalLow or >= criticalHigh is "critical". */
  criticalLow?: number;
  criticalHigh?: number;
  /** Sensible step for the number input. */
  step?: number;
}

export const VITAL_METRICS: Record<VitalMetricKey, VitalMetricMeta> = {
  heart_rate: {
    key: "heart_rate",
    label: "Heart rate",
    short: "HR",
    defaultUnit: "bpm",
    normal: [60, 100],
    criticalLow: 40,
    criticalHigh: 140,
    step: 1,
  },
  systolic_bp: {
    key: "systolic_bp",
    label: "Systolic BP",
    short: "SBP",
    defaultUnit: "mmHg",
    normal: [90, 130],
    criticalLow: 80,
    criticalHigh: 180,
    step: 1,
  },
  diastolic_bp: {
    key: "diastolic_bp",
    label: "Diastolic BP",
    short: "DBP",
    defaultUnit: "mmHg",
    normal: [60, 85],
    criticalLow: 50,
    criticalHigh: 110,
    step: 1,
  },
  temperature_c: {
    key: "temperature_c",
    label: "Temperature",
    short: "Temp",
    defaultUnit: "°C",
    normal: [36.1, 37.5],
    criticalLow: 35,
    criticalHigh: 39.5,
    step: 0.1,
  },
  spo2: {
    key: "spo2",
    label: "SpO₂",
    short: "SpO₂",
    defaultUnit: "%",
    normal: [95, 100],
    criticalLow: 90,
    step: 1,
  },
  respiratory_rate: {
    key: "respiratory_rate",
    label: "Respiratory rate",
    short: "RR",
    defaultUnit: "/min",
    normal: [12, 20],
    criticalLow: 8,
    criticalHigh: 28,
    step: 1,
  },
  weight_kg: {
    key: "weight_kg",
    label: "Weight",
    short: "Wt",
    defaultUnit: "kg",
    step: 0.1,
  },
  height_cm: {
    key: "height_cm",
    label: "Height",
    short: "Ht",
    defaultUnit: "cm",
    step: 0.5,
  },
  bmi: {
    key: "bmi",
    label: "BMI",
    short: "BMI",
    defaultUnit: "kg/m²",
    normal: [18.5, 24.9],
    step: 0.1,
  },
  pain: {
    key: "pain",
    label: "Pain (NRS)",
    short: "Pain",
    defaultUnit: "/10",
    normal: [0, 3],
    criticalHigh: 8,
    step: 1,
  },
};

export const VITAL_METRIC_LIST: VitalMetricMeta[] = Object.values(VITAL_METRICS);

export function statusFor(meta: VitalMetricMeta, value: number): VitalStatus {
  if (meta.criticalLow !== undefined && value <= meta.criticalLow) return "critical";
  if (meta.criticalHigh !== undefined && value >= meta.criticalHigh) return "critical";
  if (meta.normal) {
    const [lo, hi] = meta.normal;
    if (value < lo) return "low";
    if (value > hi) return "elevated";
  }
  return "normal";
}

export function trendBetween(
  curr: number,
  prev: number | undefined
): "up" | "down" | "flat" | undefined {
  if (prev === undefined) return undefined;
  const diff = curr - prev;
  // Within 1% of prior reading counts as flat — avoids jittery arrows on
  // noisy sensors.
  const threshold = Math.max(Math.abs(prev) * 0.01, 0.1);
  if (Math.abs(diff) < threshold) return "flat";
  return diff > 0 ? "up" : "down";
}

export function formatValue(value: number, step?: number): string {
  if (step !== undefined && step < 1) return value.toFixed(1);
  // BP/HR/RR/SpO2 are integers in practice.
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
