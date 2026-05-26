import { create } from "zustand";

interface AppState {
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  theme: "light" | "dark";
  setTheme: (t: "light" | "dark") => void;
  search: string;
  setSearch: (s: string) => void;
  viewMode: "table" | "cards";
  setViewMode: (m: "table" | "cards") => void;
}

export const useAppStore = create<AppState>((set) => ({
  sidebarCollapsed: false,
  toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
  theme: "light",
  setTheme: (theme) => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    set({ theme });
  },
  search: "",
  setSearch: (search) => set({ search }),
  viewMode: "table",
  setViewMode: (viewMode) => set({ viewMode }),
}));
