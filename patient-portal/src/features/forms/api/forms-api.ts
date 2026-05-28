import { api } from "@/lib/api-client";

export interface PatientFormRequest {
  id: string;
  form_type: string;
  status: string;
  notes: string | null;
  due_date: string | null;
  created_at: string;
  submitted_at: string | null;
  requested_by: string | null;
}

export interface PatientFormRequestList {
  items: PatientFormRequest[];
  pending: number;
  submitted: number;
  completed: number;
}

export const formsApi = {
  list: (): Promise<PatientFormRequestList> =>
    api.get<PatientFormRequestList>("/patient-portal/me/forms"),
};
