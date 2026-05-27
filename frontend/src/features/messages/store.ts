/**
 * In-memory messages store. Backs US-COMM-1..5 until the real backend
 * lands. State is intentionally not persisted — the seeds re-hydrate
 * on page reload so demos always look fresh.
 */
import { create } from "zustand";
import { seedConversations, seedMessages, seedParticipants } from "./mocks";
import type {
  Audience,
  Conversation,
  Message,
  Participant,
} from "./types";

interface MessagesState {
  conversations: Conversation[];
  messages: Message[];
  participants: Participant[];
  activeAudience: Audience;
  activeConversationId: string | null;
  setAudience: (a: Audience) => void;
  setActiveConversation: (id: string | null) => void;
  sendReply: (conversationId: string, body: string) => void;
  composeBroadcast: (input: {
    recipientIds: string[];
    body: string;
    urgent: boolean;
  }) => void;
}

export const useMessagesStore = create<MessagesState>((set, get) => ({
  conversations: seedConversations,
  messages: seedMessages,
  participants: seedParticipants,
  activeAudience: "patient",
  activeConversationId: "conv-2",

  setAudience: (a) =>
    set((s) => {
      const firstInAudience = s.conversations.find((c) => c.audience === a);
      return {
        activeAudience: a,
        activeConversationId: firstInAudience?.id ?? null,
      };
    }),

  setActiveConversation: (id) =>
    set((s) => ({
      activeConversationId: id,
      conversations: s.conversations.map((c) =>
        c.id === id ? { ...c, unread: 0 } : c
      ),
    })),

  sendReply: (conversationId, body) => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const nowIso = new Date().toISOString();
    const newMsg: Message = {
      id: `m-${conversationId}-${Date.now()}`,
      conversationId,
      authorId: "me",
      direction: "outgoing",
      body: trimmed,
      sentAt: nowIso,
    };
    set((s) => ({
      messages: [...s.messages, newMsg],
      conversations: s.conversations.map((c) =>
        c.id === conversationId
          ? { ...c, lastMessage: trimmed, lastMessageAt: nowIso, unread: 0 }
          : c
      ),
    }));
  },

  composeBroadcast: ({ recipientIds, body, urgent }) => {
    const trimmed = body.trim();
    if (!trimmed || recipientIds.length === 0) return;
    const nowIso = new Date().toISOString();
    const state = get();

    const newMessages: Message[] = [];
    const updatedConversations = [...state.conversations];

    for (const recipientId of recipientIds) {
      const participant = state.participants.find((p) => p.id === recipientId);
      if (!participant) continue;

      const existingIdx = updatedConversations.findIndex(
        (c) => c.participant.id === recipientId
      );
      const conversationId =
        existingIdx >= 0
          ? updatedConversations[existingIdx]!.id
          : `conv-${recipientId}-${Date.now()}`;

      newMessages.push({
        id: `m-${conversationId}-${Date.now()}-${recipientId}`,
        conversationId,
        authorId: "me",
        direction: "outgoing",
        body: trimmed,
        sentAt: nowIso,
        urgent,
      });

      if (existingIdx >= 0) {
        const prev = updatedConversations[existingIdx]!;
        updatedConversations[existingIdx] = {
          ...prev,
          lastMessage: trimmed,
          lastMessageAt: nowIso,
          unread: 0,
        };
      } else {
        updatedConversations.unshift({
          id: conversationId,
          audience: participant.audience,
          participant,
          lastMessage: trimmed,
          lastMessageAt: nowIso,
          unread: 0,
        });
      }
    }

    set({
      conversations: updatedConversations,
      messages: [...state.messages, ...newMessages],
    });
  },
}));
