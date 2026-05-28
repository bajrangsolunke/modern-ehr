import { api } from "@/lib/api-client";

export type PatientTaskKind = "form" | "task";

export interface PatientTask {
  id: string;
  kind: PatientTaskKind;
  title: string;
  description: string | null;
  status: string;
  due_date: string | null;
  created_at: string;
  requested_by: string | null;
  form_type: string | null;
}

export interface PatientTaskList {
  items: PatientTask[];
  total: number;
  forms_count: number;
  tasks_count: number;
}

export interface FormDetail {
  id: string;
  form_type: string;
  status: string;
  notes: string | null;
  due_date: string | null;
  data: Record<string, unknown> | null;
  requested_by: string | null;
  submitted_at: string | null;
}

export const tasksApi = {
  list: (): Promise<PatientTaskList> =>
    api.get<PatientTaskList>("/patient-portal/me/tasks"),

  complete: (id: string): Promise<void> =>
    api.post<void>(`/patient-portal/me/tasks/${id}/complete`),

  getForm: (id: string): Promise<FormDetail> =>
    api.get<FormDetail>(`/patient-portal/me/forms/${id}`),

  submitForm: (id: string, data: Record<string, unknown>): Promise<FormDetail> =>
    api.post<FormDetail>(`/patient-portal/me/forms/${id}/submit`, { data }),
};
