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
}

export interface PatientTaskList {
  items: PatientTask[];
  total: number;
  forms_count: number;
  tasks_count: number;
}

export const tasksApi = {
  list: (): Promise<PatientTaskList> =>
    api.get<PatientTaskList>("/patient-portal/me/tasks"),
};
