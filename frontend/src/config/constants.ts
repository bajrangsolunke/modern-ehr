export const APP_NAME = "Modern-EHR";
export const APP_TAGLINE = "AI-Native";

export const ROUTES = {
  dashboard: "/",
  patients: "/patients",
  patientProfile: (id: string) => `/patients/${id}`,
  appointments: "/appointments",
  forms: "/forms",
  /** Legacy — redirects to /forms. Keep for bookmarks. */
  docs: "/docs",
  users: "/users",
  settings: "/settings",
  messages: "/messages",
  reports: "/reports",
  reportsInsights: "/reports/insights",
  reportsPayments: "/reports/payments",
  reportsAppointments: "/reports/appointments",
  reportsPatientVolume: "/reports/patient-volume",
  reportsClinical: "/reports/clinical",
  reportsProductivity: "/reports/productivity",
  tasks: "/tasks",
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
  reports: {
    payments: (range?: unknown) => ["reports", "payments", range] as const,
    appointments: (range?: unknown, providerId?: unknown) =>
      ["reports", "appointments", range, providerId] as const,
    patientVolume: (range?: unknown) => ["reports", "patient-volume", range] as const,
    clinical: (range?: unknown) => ["reports", "clinical", range] as const,
    productivity: (range?: unknown, providerId?: unknown) =>
      ["reports", "productivity", range, providerId] as const,
    insights: ["reports", "insights"] as const,
  },
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
