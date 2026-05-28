interface AppEnv {
  API_BASE_URL: string;
  APP_NAME: string;
  MODE: "development" | "production" | "test";
}

function read(key: string, fallback: string): string {
  const value = import.meta.env[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export const env: AppEnv = {
  API_BASE_URL: read("VITE_API_BASE_URL", "http://localhost:8000/api/v1"),
  APP_NAME: read("VITE_APP_NAME", "Padmavat"),
  MODE: (import.meta.env.MODE as AppEnv["MODE"]) ?? "development",
};

export const isDev = env.MODE === "development";
export const isProd = env.MODE === "production";
