import { api } from "@/lib/api-client";

export interface DashboardGreeting {
  first_name: string;
}

export interface DashboardNextAppointment {
  id: string;
  starts_at: string;
  provider_name: string | null;
  provider_avatar_url: string | null;
  specialty: string | null;
  location: string | null;
  appointment_type: string | null;
}

export interface DashboardPendingActions {
  forms_count: number;
  tasks_count: number;
  total: number;
}

export interface DashboardRecentMessage {
  conversation_id: string;
  sender_name: string | null;
  sender_avatar_url: string | null;
  preview: string;
  sent_at: string;
}

export interface DashboardRecentDocument {
  id: string;
  name: string;
  category: string;
  created_at: string;
}

export type HealthMetricStatus = "normal" | "higher" | "lower" | "critical" | "unknown";

export interface HealthMetric {
  metric: string;
  label: string;
  value: string;
  unit: string | null;
  recorded_at: string | null;
  status: HealthMetricStatus;
  status_text: string | null;
  series: number[];
}

export interface DashboardProfile {
  gender: string | null;
  age: number | null;
  dob: string | null;
  height_cm: number | null;
  weight_kg: number | null;
  avatar_url: string | null;
}

export interface DashboardConditionInfo {
  code: string | null;
  name: string;
  diagnosed_at: string | null;
  treatment: string | null;
}

export interface DashboardAppointmentItem {
  id: string;
  starts_at: string;
  appointment_type: string | null;
  status: string;
  provider_name: string | null;
}

export interface DashboardOut {
  greeting: DashboardGreeting;
  profile: DashboardProfile;
  health_metrics: HealthMetric[];
  primary_condition: DashboardConditionInfo | null;
  recent_appointments: DashboardAppointmentItem[];
  next_appointment: DashboardNextAppointment | null;
  pending_actions: DashboardPendingActions;
  recent_message: DashboardRecentMessage | null;
  recent_documents: DashboardRecentDocument[];
}

export const dashboardApi = {
  get: (): Promise<DashboardOut> =>
    api.get<DashboardOut>("/patient-portal/me/dashboard"),
};
