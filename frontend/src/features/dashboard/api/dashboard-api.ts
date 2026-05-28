/**
 * Provider/admin dashboard endpoint client. Feeds the right-rail cards
 * (Requested tasks + Messages notification) — KPI tiles on the left
 * are still mock-driven.
 */
import { api } from "@/lib/api-client";

export type DashboardTaskPriority = "low" | "medium" | "high";
export type DashboardTaskStatus =
  | "new"
  | "in_progress"
  | "completed"
  | "cancelled";
export type DashboardTaskType = "user" | "patient";

export interface DashboardTask {
  id: string;
  title: string;
  priority: DashboardTaskPriority;
  status: DashboardTaskStatus;
  taskType: DashboardTaskType;
  dueDate: string | null;
  patientId: string | null;
  patientName: string | null;
  createdAt: string;
}

export interface DashboardMessage {
  conversationId: string;
  senderName: string;
  preview: string;
  sentAt: string;
  unreadCount: number;
}

export interface DashboardSnapshot {
  requestedTasks: DashboardTask[];
  requestedTasksTotal: number;
  unreadMessagesCount: number;
  recentUnreadMessages: DashboardMessage[];
}

interface BackendTaskDto {
  id: string;
  title: string;
  priority: DashboardTaskPriority;
  status: DashboardTaskStatus;
  task_type: DashboardTaskType;
  due_date: string | null;
  patient_id: string | null;
  patient_name: string | null;
  created_at: string;
}

interface BackendMessageDto {
  conversation_id: string;
  sender_name: string;
  preview: string;
  sent_at: string;
  unread_count: number;
}

interface BackendSnapshotDto {
  requested_tasks: BackendTaskDto[];
  requested_tasks_total: number;
  unread_messages_count: number;
  recent_unread_messages: BackendMessageDto[];
}

function mapTask(dto: BackendTaskDto): DashboardTask {
  return {
    id: dto.id,
    title: dto.title,
    priority: dto.priority,
    status: dto.status,
    taskType: dto.task_type,
    dueDate: dto.due_date,
    patientId: dto.patient_id,
    patientName: dto.patient_name,
    createdAt: dto.created_at,
  };
}

function mapMessage(dto: BackendMessageDto): DashboardMessage {
  return {
    conversationId: dto.conversation_id,
    senderName: dto.sender_name,
    preview: dto.preview,
    sentAt: dto.sent_at,
    unreadCount: dto.unread_count,
  };
}

export const dashboardApi = {
  snapshot: async (): Promise<DashboardSnapshot> => {
    const dto = await api.get<BackendSnapshotDto>("/dashboard");
    return {
      requestedTasks: dto.requested_tasks.map(mapTask),
      requestedTasksTotal: dto.requested_tasks_total,
      unreadMessagesCount: dto.unread_messages_count,
      recentUnreadMessages: dto.recent_unread_messages.map(mapMessage),
    };
  },
};
