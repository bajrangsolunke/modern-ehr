import { api } from "@/lib/api-client";

export type NotificationKind = "message" | "appointment" | "document" | "form";

export interface PatientNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string | null;
  timestamp: string;
  href: string | null;
}

export interface PatientNotificationList {
  items: PatientNotification[];
  total: number;
}

export const notificationsApi = {
  list: (): Promise<PatientNotificationList> =>
    api.get<PatientNotificationList>("/patient-portal/me/notifications"),
};
