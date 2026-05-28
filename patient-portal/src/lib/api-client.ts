import { env } from "@/config/env";
import { STORAGE_KEYS } from "@/config/constants";

export class ApiError extends Error {
  status: number;
  payload: unknown;
  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.status = status;
    this.payload = payload;
  }
}

let logoutListener: (() => void) | null = null;

export function registerLogout(fn: () => void) {
  logoutListener = fn;
}

function getToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.accessToken);
}

async function attemptRefresh(): Promise<string | null> {
  const refresh = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refresh) return null;
  try {
    const res = await fetch(`${env.API_BASE_URL}/patient-auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      access_token: string;
      refresh_token: string;
    };
    localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
    localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
    return data.access_token;
  } catch {
    return null;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  skipAuth?: boolean;
  searchParams?: Record<string, string | number | undefined>;
}

function buildUrl(path: string, params?: RequestOptions["searchParams"]) {
  const url = new URL(`${env.API_BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function doRequest<T>(path: string, options: RequestOptions): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  const token = options.skipAuth ? null : getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let res = await fetch(buildUrl(path, options.searchParams), {
    method: options.method ?? "GET",
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  if (res.status === 401 && !options.skipAuth) {
    const fresh = await attemptRefresh();
    if (fresh) {
      headers.Authorization = `Bearer ${fresh}`;
      res = await fetch(buildUrl(path, options.searchParams), {
        method: options.method ?? "GET",
        headers,
        body:
          options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } else if (logoutListener) {
      logoutListener();
    }
  }

  if (res.status === 204) return undefined as T;

  const contentType = res.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await res.json()
    : await res.text();

  if (!res.ok) {
    const message =
      payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : res.statusText || "Request failed";
    throw new ApiError(res.status, message, payload);
  }
  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: Omit<RequestOptions, "method" | "body">) =>
    doRequest<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: Omit<RequestOptions, "method" | "body">) =>
    doRequest<T>(path, { ...opts, method: "POST", body }),
};
