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
};
