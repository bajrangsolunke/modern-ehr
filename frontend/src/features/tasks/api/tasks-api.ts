import { api } from "@/lib/api-client";
import { stripUndefined } from "@/lib/api-utils";

export type TaskCategory =
  | "reminders"
  | "document"
  | "image_order"
  | "lab_order"
  | "referral"
  | "payment"
  | "unsigned_encounter"
  | "other";

export type TaskPriority = "low" | "medium" | "high";
export type TaskStatus = "new" | "in_progress" | "completed" | "cancelled";
export type TaskScope = "all" | "mine" | "assigned";
export type TaskAudience = "all" | "patients" | "users";
export type TaskType = "user" | "patient";

export interface Task {
  id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  taskType: TaskType;
  createdByUserId: string | null;
  createdByName: string | null;
  assignedToUserId: string | null;
  assignedToName: string | null;
  patientId: string | null;
  patientName: string | null;
  dueDate: string | null;
  completedAt: string | null;
  completedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface BackendTaskDto {
  id: string;
  title: string;
  description: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  status: TaskStatus;
  task_type: TaskType;
  created_by_user_id: string | null;
  created_by_name: string | null;
  assigned_to_user_id: string | null;
  assigned_to_name: string | null;
  patient_id: string | null;
  patient_name: string | null;
  due_date: string | null;
  completed_at: string | null;
  completed_by_user_id: string | null;
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

export interface TaskPage {
  items: Task[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface TaskFilters {
  scope?: TaskScope;
  /** "patients" → only tasks linked to a patient; "users" → only
   *  internal/team tasks. "all" or omitted → no audience filter. */
  audience?: TaskAudience;
  q?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  category?: TaskCategory;
  /** Scope the list to a single patient. Used by the patient-chart
   *  care-plan checklist. */
  patient_id?: string;
  page?: number;
  page_size?: number;
}

export interface TaskInput {
  title: string;
  description?: string | null;
  category: TaskCategory;
  priority: TaskPriority;
  task_type?: TaskType;
  assigned_to_user_id?: string | null;
  patient_id?: string | null;
  due_date?: string | null;
}

export interface TaskUpdate {
  title?: string;
  description?: string | null;
  category?: TaskCategory;
  priority?: TaskPriority;
  status?: TaskStatus;
  task_type?: TaskType;
  assigned_to_user_id?: string | null;
  patient_id?: string | null;
  due_date?: string | null;
}

function mapTask(dto: BackendTaskDto): Task {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    category: dto.category,
    priority: dto.priority,
    status: dto.status,
    taskType: dto.task_type,
    createdByUserId: dto.created_by_user_id,
    createdByName: dto.created_by_name,
    assignedToUserId: dto.assigned_to_user_id,
    assignedToName: dto.assigned_to_name,
    patientId: dto.patient_id,
    patientName: dto.patient_name,
    dueDate: dto.due_date,
    completedAt: dto.completed_at,
    completedByUserId: dto.completed_by_user_id,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}

export const tasksApi = {
  list: async (filters: TaskFilters): Promise<TaskPage> => {
    const data = await api.get<BackendPage<BackendTaskDto>>("/tasks", {
      searchParams: stripUndefined(filters) as Record<string, string | number>,
    });
    return {
      items: data.items.map(mapTask),
      total: data.total,
      page: data.page,
      page_size: data.page_size,
      pages: data.pages,
    };
  },

  get: async (id: string): Promise<Task> => {
    const dto = await api.get<BackendTaskDto>(`/tasks/${id}`);
    return mapTask(dto);
  },

  create: async (input: TaskInput): Promise<Task> => {
    const dto = await api.post<BackendTaskDto>("/tasks", input);
    return mapTask(dto);
  },

  update: async (id: string, input: TaskUpdate): Promise<Task> => {
    const dto = await api.patch<BackendTaskDto>(`/tasks/${id}`, input);
    return mapTask(dto);
  },

  delete: (id: string): Promise<void> => api.delete(`/tasks/${id}`),
};
