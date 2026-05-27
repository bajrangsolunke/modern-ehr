/**
 * Transient "X is typing…" tracker. Keyed by conversationId, holds a
 * Map of userId → expire timestamp (epoch ms). Entries auto-expire
 * ~4 seconds after the last typing ping; a global interval prunes
 * the map so consumers don't see stale entries.
 */
import { create } from "zustand";

const TYPING_TTL_MS = 4_000;

interface TypingState {
  /** conversationId → (userId → expiresAt epoch ms) */
  conversations: Record<string, Record<string, number>>;
  recordTyping: (conversationId: string, userId: string) => void;
  prune: () => void;
}

export const useTypingStore = create<TypingState>((set) => ({
  conversations: {},

  recordTyping: (conversationId, userId) => {
    set((state) => {
      const existing = state.conversations[conversationId] ?? {};
      return {
        conversations: {
          ...state.conversations,
          [conversationId]: {
            ...existing,
            [userId]: Date.now() + TYPING_TTL_MS,
          },
        },
      };
    });
  },

  prune: () => {
    set((state) => {
      const now = Date.now();
      let dirty = false;
      const next: Record<string, Record<string, number>> = {};
      for (const [convId, users] of Object.entries(state.conversations)) {
        const liveUsers: Record<string, number> = {};
        for (const [uid, expires] of Object.entries(users)) {
          if (expires > now) liveUsers[uid] = expires;
          else dirty = true;
        }
        if (Object.keys(liveUsers).length > 0) next[convId] = liveUsers;
        else if (convId in state.conversations) dirty = true;
      }
      return dirty ? { conversations: next } : state;
    });
  },
}));

// Single timer prunes the store every second. The store is a module
// singleton so this only runs once per app session.
if (typeof window !== "undefined") {
  window.setInterval(() => {
    useTypingStore.getState().prune();
  }, 1_000);
}

export function selectTypingUsers(
  state: TypingState,
  conversationId: string | null
): string[] {
  if (!conversationId) return [];
  const users = state.conversations[conversationId];
  if (!users) return [];
  const now = Date.now();
  return Object.entries(users)
    .filter(([, expires]) => expires > now)
    .map(([uid]) => uid);
}
