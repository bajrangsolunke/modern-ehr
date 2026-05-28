import { api } from "@/lib/api-client";

export interface PatientAppointment {
  id: string;
  starts_at: string;
  duration_minutes: number;
  type: string;
  status: string;
  room: string | null;
  reason: string | null;
  provider_name: string | null;
  provider_specialty: string | null;
}

export interface PatientAppointmentList {
  upcoming: PatientAppointment[];
  past: PatientAppointment[];
}

export const appointmentsApi = {
  list: (): Promise<PatientAppointmentList> =>
    api.get<PatientAppointmentList>("/patient-portal/me/appointments"),
};
