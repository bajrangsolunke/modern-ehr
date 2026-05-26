export const APP_NAME = "Symptra";
export const APP_TAGLINE = "AI-native EHR platform";

export const ROUTES = {
  dashboard: "/",
  patients: "/patients",
  patientProfile: (id: string) => `/patients/${id}`,
  insights: "/insights",
  appointments: "/appointments",
  docs: "/docs",
  team: "/team",
  mobile: "/mobile",
} as const;

export const QUERY_KEYS = {
  currentUser: ["currentUser"] as const,
  patients: (filters?: unknown) => ["patients", filters] as const,
  patient: (id: string) => ["patients", id] as const,
  appointments: ["appointments"] as const,
  analytics: ["analytics"] as const,
};

export const STORAGE_KEYS = {
  accessToken: "symptra.access_token",
  refreshToken: "symptra.refresh_token",
  theme: "symptra.theme",
} as const;

export const PAGE_SIZE = 20;
