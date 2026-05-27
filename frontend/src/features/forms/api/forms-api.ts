import { api } from "@/lib/api-client";
import { stripUndefined } from "@/lib/api-utils";

export type FormType =
  | "consent"
  | "intake"
  | "roi"
  | "insurance"
  | "discharge"
  | "referral";

export type FormStatus = "pending" | "submitted" | "completed" | "denied";

/** A single form-request lifecycle row + the filled payload. */
export interface FormRequest {
  id: string;
  patientId: string;
  patientName: string | null;
  patientMrn: string | null;
  formType: FormType;
  status: FormStatus;

  requestedByUserId: string | null;
  requestedByName: string | null;
  notes: string | null;
  dueDate: string | null;

  data: Record<string, unknown> | null;
  submittedAt: string | null;
  submittedByUserId: string | null;
  submittedByName: string | null;

  reviewedAt: string | null;
  reviewedByUserId: string | null;
  reviewedByName: string | null;
  reviewNotes: string | null;

  taskId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BackendDto {
  id: string;
  patient_id: string;
  patient_name: string | null;
  patient_mrn: string | null;
  form_type: FormType;
  status: FormStatus;
  requested_by_user_id: string | null;
  requested_by_name: string | null;
  notes: string | null;
  due_date: string | null;
  data: Record<string, unknown> | null;
  submitted_at: string | null;
  submitted_by_user_id: string | null;
  submitted_by_name: string | null;
  reviewed_at: string | null;
  reviewed_by_user_id: string | null;
  reviewed_by_name: string | null;
  review_notes: string | null;
  task_id: string | null;
  created_at: string;
  updated_at: string;
}

interface BackendPage<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface FormRequestPage {
  items: FormRequest[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface FormRequestFilters {
  q?: string;
  form_type?: FormType;
  status?: FormStatus;
  patient_id?: string;
  page?: number;
  page_size?: number;
}

function map(dto: BackendDto): FormRequest {
  return {
    id: dto.id,
    patientId: dto.patient_id,
    patientName: dto.patient_name,
    patientMrn: dto.patient_mrn,
    formType: dto.form_type,
    status: dto.status,
    requestedByUserId: dto.requested_by_user_id,
    requestedByName: dto.requested_by_name,
    notes: dto.notes,
    dueDate: dto.due_date,
    data: dto.data,
    submittedAt: dto.submitted_at,
    submittedByUserId: dto.submitted_by_user_id,
    submittedByName: dto.submitted_by_name,
    reviewedAt: dto.reviewed_at,
    reviewedByUserId: dto.reviewed_by_user_id,
    reviewedByName: dto.reviewed_by_name,
    reviewNotes: dto.review_notes,
    taskId: dto.task_id,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export const formsApi = {
  list: async (filters: FormRequestFilters): Promise<FormRequestPage> => {
    const data = await api.get<BackendPage<BackendDto>>("/form-requests", {
      searchParams: stripUndefined(filters) as Record<string, string | number>,
    });
    return {
      items: data.items.map(map),
      total: data.total,
      page: data.page,
      page_size: data.page_size,
      pages: data.pages,
    };
  },

  get: async (id: string): Promise<FormRequest> => {
    const dto = await api.get<BackendDto>(`/form-requests/${id}`);
    return map(dto);
  },

  request: async (input: {
    patient_id: string;
    form_type: FormType;
    notes?: string | null;
    due_date?: string | null;
  }): Promise<FormRequest> => {
    const dto = await api.post<BackendDto>("/form-requests", input);
    return map(dto);
  },

  submit: async (
    id: string,
    data: Record<string, unknown>
  ): Promise<FormRequest> => {
    const dto = await api.post<BackendDto>(`/form-requests/${id}/submit`, {
      data,
    });
    return map(dto);
  },

  review: async (
    id: string,
    input: { decision: "completed" | "denied"; review_notes?: string | null }
  ): Promise<FormRequest> => {
    const dto = await api.post<BackendDto>(`/form-requests/${id}/review`, input);
    return map(dto);
  },

  delete: (id: string): Promise<void> => api.delete(`/form-requests/${id}`),
};
