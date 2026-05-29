export const APP_NAME = "Modern-EHR";
export const APP_TAGLINE = "AI-Native";

export const ROUTES = {
  dashboard: "/",
  messages: "/messages",
  appointments: "/appointments",
  docs: "/docs",
  tasks: "/tasks",
  notifications: "/notifications",
  billing: "/billing",
  settings: "/settings",
  login: "/login",
  setup: "/setup",
  reset: "/reset",
} as const;

export const QUERY_KEYS = {
  auth: { me: ["auth", "me"] as const },
  dashboard: { me: ["dashboard", "me"] as const },
};

export const STORAGE_KEYS = {
  accessToken: "padmavat-portal.access_token",
  refreshToken: "padmavat-portal.refresh_token",
} as const;
