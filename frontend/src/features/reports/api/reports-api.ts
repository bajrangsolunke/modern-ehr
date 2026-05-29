/**
 * Typed API client for the Reports module.
 * All monetary values come back as floats (dollars) from the backend.
 */
import { api } from "@/lib/api-client";
import type { DateRange } from "../components/DateRangeFilter";

// ---- Shared ----

export interface ReportRange {
  start: string;
  end: string;
}

// ---- Payments ----

export interface PaymentSeriesPoint {
  date: string;
  gross: number;
  refunds: number;
  net: number;
}

export interface PaymentRow {
  id: string;
  created_at: string;
  patient_name: string;
  method: string | null;
  amount: number;
  status: string;
}

export interface ARAgingBucket {
  bucket: string;
  patient_count: number;
  total_outstanding: number;
}

export interface PaymentReport {
  range: ReportRange;
  gross_collected: number;
  refunds: number;
  net_collected: number;
  transaction_count: number;
  series: PaymentSeriesPoint[];
  transactions: PaymentRow[];
  ar_aging: ARAgingBucket[];
}

// ---- Appointments ----

export interface AppointmentSeriesPoint {
  date: string;
  completed: number;
  cancelled: number;
  no_show: number;
  scheduled: number;
}

export interface AppointmentRow {
  id: string;
  starts_at: string;
  patient_name: string;
  provider_name: string | null;
  type: string | null;
  status: string;
  duration_minutes: number | null;
}

export interface AppointmentReport {
  range: ReportRange;
  total: number;
  completed: number;
  cancelled: number;
  no_show: number;
  show_rate: number;
  series: AppointmentSeriesPoint[];
  rows: AppointmentRow[];
  by_type: { type: string; count: number }[];
}

// ---- Patient volume ----

export interface PatientVolumePoint {
  date: string;
  new_patients: number;
}

export interface DemographicSlice {
  label: string;
  count: number;
}

export interface PatientVolumeReport {
  range: ReportRange;
  total_active: number;
  new_in_period: number;
  returning_in_period: number;
  series: PatientVolumePoint[];
  by_sex: DemographicSlice[];
  by_age_band: DemographicSlice[];
}

// ---- Clinical ----

export interface DiagnosisRow {
  icd10: string | null;
  name: string;
  count: number;
}

export interface ClinicalReport {
  range: ReportRange;
  total_encounters: number;
  distinct_diagnoses: number;
  top_diagnoses: DiagnosisRow[];
}

// ---- Productivity ----

export interface ProviderProductivityRow {
  provider_id: string;
  provider_name: string;
  specialty: string | null;
  appointments_completed: number;
  notes_signed: number;
  avg_duration_minutes: number;
  no_show_count: number;
}

export interface ProductivityReport {
  range: ReportRange;
  providers: ProviderProductivityRow[];
}

// ---- Insights ----

export interface InsightsRevenueToday {
  gross: number;
  net: number;
  transaction_count: number;
}

export interface InsightsAppointmentsToday {
  total: number;
  completed: number;
  remaining: number;
}

export interface InsightsTopDiagnosis {
  icd10: string | null;
  name: string;
  count: number;
}

export interface InsightsRiskPatient {
  patient_id: string;
  patient_name: string;
  risk_level: string;
  reason: string;
}

export interface InsightsSnapshot {
  revenue_today: InsightsRevenueToday;
  appointments_today: InsightsAppointmentsToday;
  no_show_rate_30d: number;
  no_show_rate_prev_30d: number;
  top_diagnoses_30d: InsightsTopDiagnosis[];
  risk_patients: InsightsRiskPatient[];
  monthly_revenue_series: PaymentSeriesPoint[];
}

// ---- API functions ----

function rangeParams(range: DateRange) {
  return { start: range.start, end: range.end };
}

export const reportsApi = {
  payments: (range: DateRange): Promise<PaymentReport> =>
    api.get("/reports/payments", { searchParams: rangeParams(range) }),

  appointments: (range: DateRange, providerId?: string): Promise<AppointmentReport> =>
    api.get("/reports/appointments", {
      searchParams: {
        ...rangeParams(range),
        ...(providerId ? { provider_id: providerId } : {}),
      },
    }),

  patientVolume: (range: DateRange): Promise<PatientVolumeReport> =>
    api.get("/reports/patient-volume", { searchParams: rangeParams(range) }),

  clinical: (range: DateRange): Promise<ClinicalReport> =>
    api.get("/reports/clinical", { searchParams: rangeParams(range) }),

  productivity: (range: DateRange, providerId?: string): Promise<ProductivityReport> =>
    api.get("/reports/productivity", {
      searchParams: {
        ...rangeParams(range),
        ...(providerId ? { provider_id: providerId } : {}),
      },
    }),

  insights: (): Promise<InsightsSnapshot> => api.get("/reports/insights"),
};
