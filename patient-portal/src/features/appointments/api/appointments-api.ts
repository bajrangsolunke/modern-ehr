import { api } from "@/lib/api-client";

export type PatientAppointmentModality = "in_person" | "virtual";

export interface PatientAppointment {
  id: string;
  starts_at: string;
  duration_minutes: number;
  type: string;
  modality: PatientAppointmentModality;
  status: string;
  room: string | null;
  reason: string | null;
  provider_name: string | null;
  provider_specialty: string | null;
  provider_avatar_url: string | null;
  service_name: string | null;
  invoice_id: string | null;
  invoice_balance_cents: number | null;
  invoice_total_cents: number | null;
}

export interface PatientAppointmentList {
  upcoming: PatientAppointment[];
  past: PatientAppointment[];
}

export const appointmentsApi = {
  list: (): Promise<PatientAppointmentList> =>
    api.get<PatientAppointmentList>("/patient-portal/me/appointments"),
};
