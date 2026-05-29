import { api } from "@/lib/api-client";

export interface PatientConsent {
  session_id: string;
  daily_room_url: string;
  meeting_token: string;
}

export const telehealthApi = {
  consent: (appointmentId: string): Promise<PatientConsent> =>
    api.post<PatientConsent>(
      `/patient-portal/me/telehealth/${appointmentId}/consent`,
    ),
};
