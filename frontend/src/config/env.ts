/**
 * Typed environment variables.
 * Centralizes access to Vite import.meta.env so the rest of the codebase
 * never touches it directly.
 */

interface AppEnv {
  API_BASE_URL: string;
  WS_URL: string;
  APP_NAME: string;
  MODE: "development" | "production" | "test";
}

function read(key: string, fallback: string): string {
  const value = import.meta.env[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export const env: AppEnv = {
  API_BASE_URL: read("VITE_API_BASE_URL", "http://localhost:8000/api/v1"),
  WS_URL: read("VITE_WS_URL", "ws://localhost:8000/ws"),
  APP_NAME: read("VITE_APP_NAME", "Symptra"),
  MODE: (import.meta.env.MODE as AppEnv["MODE"]) ?? "development",
};

export const isDev = env.MODE === "development";
export const isProd = env.MODE === "production";
