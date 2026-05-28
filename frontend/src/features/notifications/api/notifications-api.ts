/**
 * Typed client for the in-app notifications feed. The catalogue of
 * kinds + urgency levels mirrors `app/schemas/notification.py` on the
 * backend — keep the two in lock-step.
 */
import { api } from "@/lib/api-client";

export type NotificationKind =
  // Appointments
  | "appointment_booked"
  | "appointment_today"
  | "appointment_cancelled"
  | "appointment_rescheduled"
  | "appointment_reminder_24h"
  | "appointment_reminder_1h"
  | "appointment_no_show"
  | "patient_checked_in"
  // Care team
  | "patient_assigned"
  // Tasks
  | "task_assigned"
  | "task_due_soon"
  | "task_overdue"
  // Forms
  | "form_assigned"
  | "form_due_soon"
  | "form_overdue"
  | "form_submitted"
  | "form_approved"
  | "form_denied"
  // Messages
  | "new_message"
  // Clinical
  | "lab_result_returned"
  | "lab_result_available"
  | "critical_patient_alert"
  | "unsigned_encounter"
  | "patient_vitals_submitted"
  | "patient_document_uploaded"
  | "referral_status_update"
  | "prescription_ready"
  | "visit_summary_ready"
  // Admin / system
  | "schedule_changed"
  | "account_security_event"
  // Legacy / catch-all
  | "generic";

export type NotificationUrgency = "critical" | "high" | "normal" | "low";

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  body: string | null;
  kind: NotificationKind;
  urgency: NotificationUrgency;
  relatedType: string | null;
  relatedId: string | null;
  link: string | null;
  isRead: boolean;
  createdAt: string;
}

interface BackendNotificationDto {
  id: string;
  user_id: string;
  title: string;
  body: string | null;
  kind: NotificationKind;
  urgency: NotificationUrgency;
  related_type: string | null;
  related_id: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

function mapNotification(dto: BackendNotificationDto): AppNotification {
  return {
    id: dto.id,
    userId: dto.user_id,
    title: dto.title,
    body: dto.body,
    kind: dto.kind,
    urgency: dto.urgency,
    relatedType: dto.related_type,
    relatedId: dto.related_id,
    link: dto.link,
    isRead: dto.is_read,
    createdAt: dto.created_at,
  };
}

export const notificationsApi = {
  list: async (onlyUnread = false): Promise<AppNotification[]> => {
    const items = await api.get<BackendNotificationDto[]>("/notifications", {
      searchParams: { only_unread: onlyUnread ? "true" : "false" },
    });
    return items.map(mapNotification);
  },

  unreadCount: async (): Promise<number> => {
    const data = await api.get<{ count: number }>(
      "/notifications/unread-count",
    );
    return data.count;
  },

  markRead: (id: string): Promise<void> =>
    api.post<void>(`/notifications/${id}/read`),

  readAll: async (): Promise<number> => {
    const data = await api.post<{ cleared: number }>(
      "/notifications/read-all",
    );
    return data.cleared;
  },
};
