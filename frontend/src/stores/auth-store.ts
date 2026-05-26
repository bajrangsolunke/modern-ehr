import { create } from "zustand";
import { STORAGE_KEYS } from "@/config/constants";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  demoModeActive: boolean;
  setUser: (user: User | null) => void;
  setTokens: (tokens: { access: string; refresh: string }) => void;
  setDemoMode: (active: boolean) => void;
  logout: () => void;
  hydrate: () => void;
}

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function writeStored(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: readStored(STORAGE_KEYS.accessToken),
  refreshToken: readStored(STORAGE_KEYS.refreshToken),
  demoModeActive: false,

  setUser: (user) => set({ user }),

  setTokens: ({ access, refresh }) => {
    writeStored(STORAGE_KEYS.accessToken, access);
    writeStored(STORAGE_KEYS.refreshToken, refresh);
    set({ accessToken: access, refreshToken: refresh });
  },

  setDemoMode: (active) => set({ demoModeActive: active }),

  logout: () => {
    writeStored(STORAGE_KEYS.accessToken, null);
    writeStored(STORAGE_KEYS.refreshToken, null);
    set({ user: null, accessToken: null, refreshToken: null, demoModeActive: false });
  },

  hydrate: () =>
    set({
      accessToken: readStored(STORAGE_KEYS.accessToken),
      refreshToken: readStored(STORAGE_KEYS.refreshToken),
    }),
}));

export const selectIsAuthenticated = (s: AuthState) =>
  Boolean(s.user || s.accessToken || s.demoModeActive);
