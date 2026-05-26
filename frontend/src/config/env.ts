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
  DEMO_FALLBACK: boolean;
}

function read(key: string, fallback: string): string {
  const value = import.meta.env[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

function readBool(key: string, fallback: boolean): boolean {
  const value = import.meta.env[key];
  if (value === undefined) return fallback;
  return value === "true" || value === "1";
}

export const env: AppEnv = {
  API_BASE_URL: read("VITE_API_BASE_URL", "http://localhost:8000/api/v1"),
  WS_URL: read("VITE_WS_URL", "ws://localhost:8000/ws"),
  APP_NAME: read("VITE_APP_NAME", "Padmavat"),
  MODE: (import.meta.env.MODE as AppEnv["MODE"]) ?? "development",
  DEMO_FALLBACK: readBool("VITE_DEMO_FALLBACK", import.meta.env.MODE !== "production"),
};

export const isDev = env.MODE === "development";
export const isProd = env.MODE === "production";
