export const APP_NAME = "Padmavat";
export const APP_TAGLINE = "AI-native EHR platform";

export const ROUTES = {
  dashboard: "/",
  patients: "/patients",
  patientProfile: (id: string) => `/patients/${id}`,
  appointments: "/appointments",
  docs: "/docs",
  users: "/users",
  settings: "/settings",
  mobile: "/mobile",
  messages: "/messages",
  reports: "/reports",
  reportsInsights: "/reports/insights",
} as const;

export const QUERY_KEYS = {
  auth: { me: ["auth", "me"] as const },
  patients: {
    all: ["patients"] as const,
    list: (filters?: unknown) => ["patients", "list", filters] as const,
    byId: (id: string) => ["patients", id] as const,
  },
  appointments: {
    all: ["appointments"] as const,
    upcoming: ["appointments", "upcoming"] as const,
    forPatient: (patientId: string) =>
      ["appointments", "patient", patientId] as const,
  },
  notes: {
    forPatient: (patientId: string) => ["notes", "patient", patientId] as const,
  },
  users: {
    all: ["users"] as const,
    list: (filters?: unknown) => ["users", "list", filters] as const,
    byId: (id: string) => ["users", id] as const,
  },
  analytics: { snapshot: ["analytics", "snapshot"] as const },
  ai: {
    summary: (patientId: string) => ["ai", "summary", patientId] as const,
    risk: (patientId: string) => ["ai", "risk", patientId] as const,
  },
};

export const STORAGE_KEYS = {
  accessToken: "padmavat.access_token",
  refreshToken: "padmavat.refresh_token",
  theme: "padmavat.theme",
} as const;

export const PAGE_SIZE = 20;
