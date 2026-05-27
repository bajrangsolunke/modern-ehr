import { api } from "@/lib/api-client";
import { stripUndefined } from "@/lib/api-utils";
import type { Audience, Conversation, Message, Participant } from "../types";

/* -------------------------------- DTOs ----------------------------------- */

interface BackendParticipantDto {
  id: string;
  name: string | null;
  email: string | null;
  role: string | null;
  specialty: string | null;
  avatar_url: string | null;
  last_read_at: string | null;
}

interface BackendPatientSummaryDto {
  id: string;
  name: string;
  mrn: string | null;
  dob: string | null;
  age: number | null;
  gender: string | null;
  phone: string | null;
  email: string | null;
  avatar_url: string | null;
  condition_tag: string | null;
}

interface BackendMessageDto {
  id: string;
  conversation_id: string;
  sender_user_id: string | null;
  sender_patient_id: string | null;
  body: string;
  urgent: boolean;
  sent_at: string;
}

interface BackendConversationDto {
  id: string;
  audience: Audience;
  title: string | null;
  last_message_at: string;
  last_message_preview: string | null;
  unread: number;
  patient: BackendPatientSummaryDto | null;
  participants: BackendParticipantDto[];
}

interface BackendConversationDetailDto extends BackendConversationDto {
  messages: BackendMessageDto[];
}

/* ------------------------------- mappers --------------------------------- */

function mapParticipant(dto: BackendParticipantDto): Participant {
  return {
    id: dto.id,
    audience: "clinician",
    name: dto.name ?? dto.email ?? "Unknown",
    avatarUrl: dto.avatar_url ?? undefined,
    email: dto.email ?? undefined,
    role: (dto.role as Participant["role"]) ?? undefined,
    specialty: dto.specialty ?? undefined,
    lastReadAt: dto.last_read_at ?? undefined,
  };
}

function patientToParticipant(dto: BackendPatientSummaryDto): Participant {
  return {
    id: dto.id,
    audience: "patient",
    name: dto.name,
    avatarUrl: dto.avatar_url ?? undefined,
    mrn: dto.mrn ?? undefined,
    dob: dto.dob ?? undefined,
    age: dto.age ?? undefined,
    gender: (dto.gender as Participant["gender"]) ?? undefined,
    phone: dto.phone ?? undefined,
    email: dto.email ?? undefined,
    conditionTag:
      (dto.condition_tag as Participant["conditionTag"]) ?? undefined,
  };
}

function mapConversation(dto: BackendConversationDto): Conversation {
  const participant: Participant =
    dto.patient !== null
      ? patientToParticipant(dto.patient)
      : dto.participants[0]
        ? mapParticipant(dto.participants[0])
        : {
            id: dto.id,
            audience: dto.audience,
            name: dto.title ?? "Conversation",
          };
  return {
    id: dto.id,
    audience: dto.audience,
    participant,
    lastMessage: dto.last_message_preview ?? "",
    lastMessageAt: dto.last_message_at,
    unread: dto.unread,
  };
}

function mapMessage(dto: BackendMessageDto): Message {
  return {
    id: dto.id,
    conversationId: dto.conversation_id,
    authorId: dto.sender_user_id ?? dto.sender_patient_id ?? "unknown",
    direction: dto.sender_user_id ? "outgoing" : "incoming",
    body: dto.body,
    sentAt: dto.sent_at,
    urgent: dto.urgent || undefined,
  };
}

/* -------------------------------- API ------------------------------------ */

export interface ConversationFilters {
  audience?: Audience;
  q?: string;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: Message[];
  /** All staff participants in the thread — used to compute read
   *  receipts on outgoing bubbles. Empty for patient threads. */
  participants: Participant[];
}

export const messagesApi = {
  listConversations: async (
    filters: ConversationFilters
  ): Promise<Conversation[]> => {
    const data = await api.get<BackendConversationDto[]>(
      "/messages/conversations",
      {
        searchParams: stripUndefined(filters) as Record<string, string>,
      }
    );
    return data.map(mapConversation);
  },

  getConversation: async (id: string): Promise<ConversationDetail> => {
    const data = await api.get<BackendConversationDetailDto>(
      `/messages/conversations/${id}`
    );
    return {
      conversation: mapConversation(data),
      messages: data.messages.map(mapMessage),
      participants: data.participants.map(mapParticipant),
    };
  },

  send: async (
    conversationId: string,
    input: { body: string; urgent?: boolean }
  ): Promise<Message> => {
    const data = await api.post<BackendMessageDto>(
      `/messages/conversations/${conversationId}/messages`,
      {
        body: input.body,
        urgent: input.urgent ?? false,
      }
    );
    return mapMessage(data);
  },

  createPatientConversation: async (input: {
    patientId: string;
    body: string;
    urgent?: boolean;
  }): Promise<ConversationDetail> => {
    const data = await api.post<BackendConversationDetailDto>(
      "/messages/conversations/patient",
      {
        patient_id: input.patientId,
        body: input.body,
        urgent: input.urgent ?? false,
      }
    );
    return {
      conversation: mapConversation(data),
      messages: data.messages.map(mapMessage),
      participants: data.participants.map(mapParticipant),
    };
  },

  createClinicianConversation: async (input: {
    userIds: string[];
    body: string;
    urgent?: boolean;
  }): Promise<ConversationDetail> => {
    const data = await api.post<BackendConversationDetailDto>(
      "/messages/conversations/clinician",
      {
        user_ids: input.userIds,
        body: input.body,
        urgent: input.urgent ?? false,
      }
    );
    return {
      conversation: mapConversation(data),
      messages: data.messages.map(mapMessage),
      participants: data.participants.map(mapParticipant),
    };
  },

  markRead: (conversationId: string): Promise<void> =>
    api.post(`/messages/conversations/${conversationId}/read`, {
      last_read_at: new Date().toISOString(),
    }),

  pingTyping: (conversationId: string): Promise<void> =>
    api.post(`/messages/conversations/${conversationId}/typing`, {}),

  suggestReply: async (conversationId: string): Promise<string> => {
    const data = await api.post<{ suggestion: string }>(
      `/messages/conversations/${conversationId}/suggest-reply`,
      {}
    );
    return data.suggestion;
  },
};
