export const APP_NAME = "Padmavat";

export const ROUTES = {
  dashboard: "/",
  messages: "/messages",
  appointments: "/appointments",
  docs: "/docs",
  tasks: "/tasks",
  notifications: "/notifications",
  settings: "/settings",
  login: "/login",
  setup: "/setup",
  reset: "/reset",
} as const;

export const STORAGE_KEYS = {
  accessToken: "padmavat-portal.access_token",
  refreshToken: "padmavat-portal.refresh_token",
} as const;
