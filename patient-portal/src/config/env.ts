function read(key: string, fallback: string): string {
  const value = import.meta.env[key];
  return typeof value === "string" && value.length > 0 ? value : fallback;
}

export const env = {
  API_BASE_URL: read("VITE_API_BASE_URL", "http://localhost:8000/api/v1"),
} as const;
