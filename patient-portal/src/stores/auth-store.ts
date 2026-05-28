import { create } from "zustand";
import { STORAGE_KEYS } from "@/config/constants";
import type { PatientMe } from "@/types";

interface AuthState {
  me: PatientMe | null;
  accessToken: string | null;
  refreshToken: string | null;
  setMe: (me: PatientMe | null) => void;
  setTokens: (tokens: { access: string; refresh: string }) => void;
  logout: () => void;
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
  me: null,
  accessToken: readStored(STORAGE_KEYS.accessToken),
  refreshToken: readStored(STORAGE_KEYS.refreshToken),

  setMe: (me) => set({ me }),

  setTokens: ({ access, refresh }) => {
    writeStored(STORAGE_KEYS.accessToken, access);
    writeStored(STORAGE_KEYS.refreshToken, refresh);
    set({ accessToken: access, refreshToken: refresh });
  },

  logout: () => {
    writeStored(STORAGE_KEYS.accessToken, null);
    writeStored(STORAGE_KEYS.refreshToken, null);
    set({ me: null, accessToken: null, refreshToken: null });
  },
}));

export const selectIsAuthenticated = (s: AuthState) => Boolean(s.accessToken);
