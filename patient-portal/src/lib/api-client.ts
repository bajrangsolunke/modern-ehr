/**
 * Typed fetch wrapper for the Padmavat patient-portal backend.
 * - Attaches the access token from localStorage
 * - On 401, attempts a single /patient-auth/refresh + retry; if that
 *   also fails, fires the registered logout listener.
 */
import { env } from "@/config/env";
import { STORAGE_KEYS } from "@/config/constants";

export class ApiError extends Error {
  readonly status: number;
  readonly data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  searchParams?: Record<string, string | number | boolean | undefined | null>;
  skipAuth?: boolean;
};

let logoutListener: (() => void) | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function registerLogout(fn: () => void) {
  logoutListener = fn;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.accessToken);
}

function extractErrorMessage(payload: unknown, statusText: string): string {
  const fallback = statusText || "Request failed";
  if (!payload || typeof payload !== "object") return fallback;
  const detail = (payload as { detail?: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) =>
        d && typeof d === "object" && "msg" in d ? String(d.msg) : null
      )
      .filter(Boolean);
    if (msgs.length) return msgs.slice(0, 3).join(" · ");
  }
  if (detail && typeof detail === "object") {
    const d = detail as { message?: string; errors?: Array<unknown> };
    if (typeof d.message === "string") {
      const fieldMsgs = (d.errors ?? [])
        .map((e) =>
          e && typeof e === "object" && "msg" in e
            ? String((e as { msg: unknown }).msg)
            : null
        )
        .filter(Boolean)
        .slice(0, 3);
      return fieldMsgs.length
        ? `${d.message} — ${fieldMsgs.join("; ")}`
        : d.message;
    }
  }
  return fallback;
}

function buildUrl(path: string, params?: RequestOptions["searchParams"]) {
  const url = new URL(path.startsWith("http") ? path : `${env.API_BASE_URL}${path}`);
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function attemptRefresh(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  const refresh = localStorage.getItem(STORAGE_KEYS.refreshToken);
  if (!refresh) return null;

  refreshInFlight = (async () => {
    try {
      const res = await fetch(`${env.API_BASE_URL}/patient-auth/refresh`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refresh }),
      });
      if (!res.ok) return null;
      const data = (await res.json()) as { access_token: string; refresh_token: string };
      localStorage.setItem(STORAGE_KEYS.accessToken, data.access_token);
      localStorage.setItem(STORAGE_KEYS.refreshToken, data.refresh_token);
      return data.access_token;
    } catch {
      return null;
    } finally {
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}

async function doFetch(path: string, options: RequestOptions): Promise<Response> {
  const { body, searchParams, headers, skipAuth, ...rest } = options;
  const token = skipAuth ? null : getToken();
  return fetch(buildUrl(path, searchParams), {
    ...rest,
    headers: {
      Accept: "application/json",
      ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  let response: Response;
  try {
    response = await doFetch(path, options);
  } catch (err) {
    throw err instanceof Error ? err : new Error(String(err));
  }

  if (response.status === 401 && !options.skipAuth) {
    const newToken = await attemptRefresh();
    if (newToken) {
      response = await doFetch(path, options);
    } else if (logoutListener) {
      logoutListener();
    }
  }

  if (response.status === 204) return undefined as T;

  const contentType = response.headers.get("content-type") ?? "";
  const payload: unknown = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = extractErrorMessage(payload, response.statusText);
    throw new ApiError(response.status, message, payload);
  }

  return payload as T;
}

export const api = {
  get: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "GET" }),
  post: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "PUT", body }),
  delete: <T>(path: string, opts?: RequestOptions) =>
    request<T>(path, { ...opts, method: "DELETE" }),
};
