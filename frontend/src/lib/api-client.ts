/**
 * Typed fetch wrapper for the Padmavat backend.
 * - Attaches the access token from the auth store
 * - On 401, attempts a single refresh + retry; if that also fails, logs out
 * - On connectivity failure, returns demoFallback() if provided and DEMO_FALLBACK
 *   is enabled — never on HTTP error responses (4xx/5xx propagate normally)
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
  demoFallback?: () => unknown;
  skipAuth?: boolean;
};

let demoModeListener: ((active: boolean) => void) | null = null;
let logoutListener: (() => void) | null = null;
let onFallbackFiredOnce = false;
let firstFallbackNoticeListener: (() => void) | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export function registerAuthListeners(opts: {
  onDemoModeChange: (active: boolean) => void;
  onLogout: () => void;
  onFirstFallback: () => void;
}) {
  demoModeListener = opts.onDemoModeChange;
  logoutListener = opts.onLogout;
  firstFallbackNoticeListener = opts.onFirstFallback;
}

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(STORAGE_KEYS.accessToken);
}

/**
 * Pull a human-readable message out of an error payload. Handles:
 *   - { detail: "string" }                              → that string
 *   - { detail: { message, errors: [...] } }            → message + first field
 *   - { detail: [{ loc, msg, type }, ...] } (Pydantic)  → joined field msgs
 *   - everything else                                   → status text
 */
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
      const res = await fetch(`${env.API_BASE_URL}/auth/refresh`, {
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
      ...(body ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
    body: body ? JSON.stringify(body) : undefined,
  });
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { demoFallback } = options;

  let response: Response;
  try {
    response = await doFetch(path, options);
  } catch (err) {
    // Connectivity failure (network down, DNS, CORS preflight, offline).
    // HTTP errors don't end up here — they come back as a response with !ok.
    if (env.DEMO_FALLBACK && demoFallback) {
      if (demoModeListener) demoModeListener(true);
      if (!onFallbackFiredOnce && firstFallbackNoticeListener) {
        onFallbackFiredOnce = true;
        firstFallbackNoticeListener();
      }
      return demoFallback() as T;
    }
    throw err instanceof Error ? err : new Error(String(err));
  }

  // Try silent refresh on 401, exactly once.
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
