import { api } from "@/lib/api-client";

export interface ConversationSummary {
  id: string;
  title: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  participants: string[];
  unread: boolean;
}

export interface ConversationList {
  items: ConversationSummary[];
}

export interface Message {
  id: string;
  conversation_id: string;
  body: string;
  urgent: boolean;
  sent_at: string;
  sender_kind: "patient" | "user";
  sender_name: string | null;
}

export interface ConversationDetail {
  id: string;
  title: string | null;
  participants: string[];
  messages: Message[];
  /** Highest `last_read_at` across staff participants. Used to flip
   *  the patient's outgoing bubbles to ✓✓ once any clinician on the
   *  thread has opened it. Null = no staff have read yet. */
  staff_last_read_at: string | null;
}

export const messagesApi = {
  listConversations: (): Promise<ConversationList> =>
    api.get<ConversationList>("/patient-portal/me/conversations"),

  getConversation: (id: string): Promise<ConversationDetail> =>
    api.get<ConversationDetail>(`/patient-portal/me/conversations/${id}`),

  sendMessage: (id: string, body: string): Promise<Message> =>
    api.post<Message>(`/patient-portal/me/conversations/${id}/messages`, {
      body,
    }),

  /** Patient just viewed the thread. Backend bumps
   *  `patient_last_read_at` + broadcasts `conversation.read` so the
   *  provider portal flips outgoing bubbles to ✓✓. */
  markRead: (id: string): Promise<void> =>
    api.post<void>(`/patient-portal/me/conversations/${id}/read`, {
      last_read_at: new Date().toISOString(),
    }),

  /** Best-effort typing ping. Failures are silent — the indicator
   *  just won't render on the other side. */
  pingTyping: (id: string): Promise<void> =>
    api.post<void>(`/patient-portal/me/conversations/${id}/typing`, {}),
};
