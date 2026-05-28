import { api } from "@/lib/api-client";

export interface DashboardGreeting {
  first_name: string;
}

export interface DashboardNextAppointment {
  id: string;
  starts_at: string;
  provider_name: string | null;
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
  preview: string;
  sent_at: string;
}

export interface DashboardRecentDocument {
  id: string;
  name: string;
  category: string;
  created_at: string;
}

export interface DashboardOut {
  greeting: DashboardGreeting;
  next_appointment: DashboardNextAppointment | null;
  pending_actions: DashboardPendingActions;
  recent_message: DashboardRecentMessage | null;
  recent_documents: DashboardRecentDocument[];
}

export const dashboardApi = {
  get: (): Promise<DashboardOut> =>
    api.get<DashboardOut>("/patient-portal/me/dashboard"),
};
