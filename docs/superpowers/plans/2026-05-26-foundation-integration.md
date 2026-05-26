# Foundation Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the Symptra React frontend to the FastAPI backend with real auth, real data, demo-mode fallback, and a complete form/error/loading UX kit — enabling end-to-end functionality for downstream phases (Patient/Dashboard polish, AI integration, new screens).

**Architecture:** Zustand auth store + extended `api-client` (Bearer auth, silent refresh, connectivity fallback) + per-feature `api/` + `hooks/` (TanStack React Query) + RHF/Zod forms + Sonner toasts. Mocks remain as the demo-mode fallback data source — zero duplication.

**Tech Stack:** React 19 · TypeScript · Vite · TailwindCSS · Zustand · TanStack React Query · React Hook Form · Zod · Sonner · Lucide React · Framer Motion · FastAPI · SQLAlchemy 2.0 async · PostgreSQL.

**Verification approach for this phase:** This codebase has no frontend test runner yet, and adding one is explicitly out of scope per the spec. Each task verifies via `npm run typecheck` + `npm run lint` + (where applicable) a manual visual check in the dev server. A frontend test runner (Vitest + RTL) is tracked as a follow-up.

**Spec:** `docs/superpowers/specs/2026-05-26-foundation-integration-design.md`

---

## Task 1: Install dependencies

**Files:**
- Modify: `frontend/package.json`

- [ ] **Step 1: Add the three new deps**

Run in `modern-ehr/frontend`:

```bash
npm install react-hook-form @hookform/resolvers zod
```

- [ ] **Step 2: Verify versions land in package.json**

Run: `cd frontend && grep -E "react-hook-form|@hookform/resolvers|zod" package.json`

Expected output (versions may vary slightly):

```
    "@hookform/resolvers": "^3.9.x",
    "react-hook-form": "^7.54.x",
    "zod": "^3.24.x",
```

- [ ] **Step 3: Run typecheck baseline**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0 (no new errors introduced)

- [ ] **Step 4: Commit**

```bash
cd /home/ttpl-lnv-0264/Modern-EHR-Design/modern-ehr
git add frontend/package.json frontend/package-lock.json
git commit -m "deps: react-hook-form, @hookform/resolvers, zod for forms"
```

---

## Task 2: Extend env config with DEMO_FALLBACK

**Files:**
- Modify: `frontend/src/config/env.ts`
- Modify: `frontend/.env.example`

- [ ] **Step 1: Add the typed flag to env.ts**

Replace the contents of `frontend/src/config/env.ts` with:

```ts
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
  APP_NAME: read("VITE_APP_NAME", "Symptra"),
  MODE: (import.meta.env.MODE as AppEnv["MODE"]) ?? "development",
  DEMO_FALLBACK: readBool("VITE_DEMO_FALLBACK", import.meta.env.MODE !== "production"),
};

export const isDev = env.MODE === "development";
export const isProd = env.MODE === "production";
```

- [ ] **Step 2: Add the flag to .env.example**

Append to `frontend/.env.example`:

```
VITE_DEMO_FALLBACK=true
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
cd /home/ttpl-lnv-0264/Modern-EHR-Design/modern-ehr
git add frontend/src/config/env.ts frontend/.env.example
git commit -m "feat(config): add typed DEMO_FALLBACK env flag"
```

---

## Task 3: Extend QUERY_KEYS

**Files:**
- Modify: `frontend/src/config/constants.ts`

- [ ] **Step 1: Replace QUERY_KEYS with the structured version**

Replace the `QUERY_KEYS` export in `frontend/src/config/constants.ts` with:

```ts
export const QUERY_KEYS = {
  auth: { me: ["auth", "me"] as const },
  patients: {
    all: ["patients"] as const,
    list: (filters?: unknown) => ["patients", "list", filters] as const,
    byId: (id: string) => ["patients", id] as const,
  },
  appointments: {
    all: ["appointments"] as const,
    upcoming: ["appointments", "upcoming"] as const,
    forPatient: (patientId: string) =>
      ["appointments", "patient", patientId] as const,
  },
  notes: {
    forPatient: (patientId: string) => ["notes", "patient", patientId] as const,
  },
  analytics: { snapshot: ["analytics", "snapshot"] as const },
  ai: {
    summary: (patientId: string) => ["ai", "summary", patientId] as const,
    risk: (patientId: string) => ["ai", "risk", patientId] as const,
  },
};
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/config/constants.ts
git commit -m "feat(config): structured QUERY_KEYS for cache invalidation"
```

---

## Task 4: Create toast lib

**Files:**
- Create: `frontend/src/lib/toast.ts`

- [ ] **Step 1: Write `lib/toast.ts`**

Create `frontend/src/lib/toast.ts`:

```ts
import { toast as sonnerToast, type ExternalToast } from "sonner";

export const toast = {
  success: (message: string, opts?: ExternalToast) =>
    sonnerToast.success(message, opts),
  error: (message: string, opts?: ExternalToast) =>
    sonnerToast.error(message, opts),
  info: (message: string, opts?: ExternalToast) => sonnerToast.info(message, opts),
  warning: (message: string, opts?: ExternalToast) =>
    sonnerToast.warning(message, opts),
  promise: <T>(
    promise: Promise<T>,
    msgs: { loading: string; success: string; error: string }
  ) => sonnerToast.promise(promise, msgs),
  dismiss: sonnerToast.dismiss,
};
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/toast.ts
git commit -m "feat(lib): toast wrapper around sonner"
```

---

## Task 5: Mount Toaster in providers

**Files:**
- Modify: `frontend/src/app/providers.tsx`

- [ ] **Step 1: Add `<Toaster />` to the provider tree**

Replace `frontend/src/app/providers.tsx`:

```tsx
import { ReactNode } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query-client";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";

interface Props {
  children: ReactNode;
}

export function AppProviders({ children }: Props) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={150}>
          <BrowserRouter>
            {children}
            <Toaster
              position="top-right"
              richColors
              closeButton
              duration={4000}
              toastOptions={{
                style: { borderRadius: "12px" },
              }}
            />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Smoke test in dev server**

Run: `cd frontend && npm run dev` then visit `http://localhost:5173`. Open devtools console and run:

```js
window.__test_toast = () => import('/src/lib/toast.ts').then(m => m.toast.success('Toast wired'))
window.__test_toast()
```

Expected: a green success toast appears top-right.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/providers.tsx
git commit -m "feat(providers): mount sonner Toaster"
```

---

## Task 6: Form lib with mapApiError

**Files:**
- Create: `frontend/src/lib/form.ts`

- [ ] **Step 1: Write `lib/form.ts`**

Create `frontend/src/lib/form.ts`:

```ts
export { useForm, Controller, FormProvider, useFormContext } from "react-hook-form";
export type { UseFormReturn, FieldValues, Path, UseFormSetError } from "react-hook-form";
export { zodResolver } from "@hookform/resolvers/zod";
export { z } from "zod";

import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { ApiError } from "@/lib/api-client";

/**
 * Maps a FastAPI-style ApiError into RHF field errors.
 * Falls back to a top-level form error when the shape isn't recognized.
 * Returns the user-facing message that didn't map to a specific field,
 * so the caller can decide whether to toast/banner it.
 */
export function mapApiError<TForm extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TForm>,
  fieldMap: Partial<Record<string, Path<TForm>>> = {}
): string {
  if (!(error instanceof ApiError)) {
    return error instanceof Error ? error.message : "Something went wrong";
  }

  // FastAPI 422 shape: { detail: [{ loc: ["body","email"], msg: "..." }, ...] }
  const data = error.data as { detail?: unknown } | null;
  if (data && Array.isArray(data.detail)) {
    let unmapped: string | null = null;
    for (const item of data.detail as Array<{ loc?: unknown[]; msg?: string }>) {
      const loc = item.loc ?? [];
      const fieldName = String(loc[loc.length - 1] ?? "");
      const mapped = (fieldMap[fieldName] ?? fieldName) as Path<TForm>;
      const msg = item.msg ?? "Invalid value";
      if (fieldName) {
        setError(mapped, { type: "server", message: msg });
      } else {
        unmapped = msg;
      }
    }
    return unmapped ?? "Please check the form for errors";
  }

  // Plain { detail: "string" } shape — e.g. 401, 409
  if (data && typeof data === "object" && "detail" in data) {
    return String((data as { detail: unknown }).detail);
  }

  return error.message || "Request failed";
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/form.ts
git commit -m "feat(lib): RHF + Zod helpers and mapApiError"
```

---

## Task 7: FormField UI component

**Files:**
- Create: `frontend/src/components/ui/form.tsx`
- Modify: `frontend/src/components/ui/index.ts`

- [ ] **Step 1: Write `components/ui/form.tsx`**

Create `frontend/src/components/ui/form.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

interface FormFieldProps {
  label?: string;
  hint?: string;
  error?: string;
  htmlFor?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}

export function FormField({
  label,
  hint,
  error,
  htmlFor,
  required,
  className,
  children,
}: FormFieldProps) {
  return (
    <div className={cn("space-y-1.5", className)}>
      {label && (
        <label
          htmlFor={htmlFor}
          className="text-sm font-medium text-foreground/90 inline-flex items-center gap-1"
        >
          {label}
          {required && <span className="text-danger">*</span>}
        </label>
      )}
      {children}
      {error ? (
        <p className="text-xs text-danger leading-tight">{error}</p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground leading-tight">{hint}</p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 2: Add FormField to barrel**

Add this line at the bottom of `frontend/src/components/ui/index.ts`:

```ts
export * from "./form";
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/form.tsx frontend/src/components/ui/index.ts
git commit -m "feat(ui): FormField wrapper for consistent form layout"
```

---

## Task 8: ErrorBanner UI component

**Files:**
- Create: `frontend/src/components/ui/error-banner.tsx`
- Modify: `frontend/src/components/ui/index.ts`

- [ ] **Step 1: Write `components/ui/error-banner.tsx`**

Create `frontend/src/components/ui/error-banner.tsx`:

```tsx
import { AlertOctagon, RotateCw } from "lucide-react";
import { Button } from "./button";
import { cn } from "@/lib/utils";

interface ErrorBannerProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  retrying?: boolean;
  className?: string;
}

export function ErrorBanner({
  title = "Couldn't load",
  message,
  onRetry,
  retrying,
  className,
}: ErrorBannerProps) {
  return (
    <div
      role="alert"
      className={cn(
        "flex items-start gap-3 rounded-2xl border border-danger/20 bg-danger/5 p-4",
        className
      )}
    >
      <div className="size-9 rounded-xl bg-danger/10 text-danger grid place-items-center shrink-0">
        <AlertOctagon className="size-4" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-sm text-muted-foreground mt-0.5">{message}</p>
      </div>
      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          disabled={retrying}
        >
          <RotateCw className={cn("size-3.5", retrying && "animate-spin")} />
          {retrying ? "Retrying…" : "Retry"}
        </Button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add ErrorBanner to barrel**

Append to `frontend/src/components/ui/index.ts`:

```ts
export * from "./error-banner";
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/error-banner.tsx frontend/src/components/ui/index.ts
git commit -m "feat(ui): ErrorBanner with retry button"
```

---

## Task 9: TableSkeleton + CardSkeleton

**Files:**
- Create: `frontend/src/components/ui/table-skeleton.tsx`
- Modify: `frontend/src/components/ui/index.ts`

- [ ] **Step 1: Write `components/ui/table-skeleton.tsx`**

Create `frontend/src/components/ui/table-skeleton.tsx`:

```tsx
import { Card } from "./card";
import { Skeleton } from "./skeleton";
import { cn } from "@/lib/utils";

export function TableSkeleton({ rows = 8, cols = 8 }: { rows?: number; cols?: number }) {
  return (
    <Card className="p-3 sm:p-4">
      <div className="space-y-2">
        <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-9 rounded-full" />
          ))}
        </div>
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={r}
            className="grid gap-2"
            style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}
          >
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-11 rounded-full" />
            ))}
          </div>
        ))}
      </div>
    </Card>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <Card className={cn("p-5", className)}>
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="size-10 rounded-2xl" />
        <Skeleton className="h-4 w-32 rounded-full" />
      </div>
      <Skeleton className="h-10 w-24 rounded-lg mb-4" />
      <Skeleton className="h-20 w-full rounded-lg" />
    </Card>
  );
}
```

- [ ] **Step 2: Add to barrel**

Append to `frontend/src/components/ui/index.ts`:

```ts
export * from "./table-skeleton";
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/ui/table-skeleton.tsx frontend/src/components/ui/index.ts
git commit -m "feat(ui): TableSkeleton + CardSkeleton for loading states"
```

---

## Task 10: Auth Zustand store

**Files:**
- Create: `frontend/src/stores/auth-store.ts`

- [ ] **Step 1: Write `stores/auth-store.ts`**

Create `frontend/src/stores/auth-store.ts`:

```ts
import { create } from "zustand";
import { STORAGE_KEYS } from "@/config/constants";
import type { User } from "@/types";

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  demoModeActive: boolean;
  setUser: (user: User | null) => void;
  setTokens: (tokens: { access: string; refresh: string }) => void;
  setDemoMode: (active: boolean) => void;
  logout: () => void;
  hydrate: () => void;
}

function readStored(key: string): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(key);
}

function writeStored(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  if (value === null) localStorage.removeItem(key);
  else localStorage.setItem(key, value);
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  accessToken: readStored(STORAGE_KEYS.accessToken),
  refreshToken: readStored(STORAGE_KEYS.refreshToken),
  demoModeActive: false,

  setUser: (user) => set({ user }),

  setTokens: ({ access, refresh }) => {
    writeStored(STORAGE_KEYS.accessToken, access);
    writeStored(STORAGE_KEYS.refreshToken, refresh);
    set({ accessToken: access, refreshToken: refresh });
  },

  setDemoMode: (active) => set({ demoModeActive: active }),

  logout: () => {
    writeStored(STORAGE_KEYS.accessToken, null);
    writeStored(STORAGE_KEYS.refreshToken, null);
    set({ user: null, accessToken: null, refreshToken: null, demoModeActive: false });
  },

  hydrate: () =>
    set({
      accessToken: readStored(STORAGE_KEYS.accessToken),
      refreshToken: readStored(STORAGE_KEYS.refreshToken),
    }),
}));

export const selectIsAuthenticated = (s: AuthState) =>
  Boolean(s.user || s.accessToken || s.demoModeActive);
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/stores/auth-store.ts
git commit -m "feat(auth): Zustand auth store with token persistence"
```

---

## Task 11: Extend api-client with refresh + demo fallback

**Files:**
- Modify: `frontend/src/lib/api-client.ts`

- [ ] **Step 1: Replace `lib/api-client.ts`**

Replace `frontend/src/lib/api-client.ts`:

```ts
/**
 * Typed fetch wrapper for the Symptra backend.
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
    const message =
      payload && typeof payload === "object" && "detail" in payload
        ? String((payload as { detail: unknown }).detail)
        : response.statusText || "Request failed";
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
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/lib/api-client.ts
git commit -m "feat(api-client): silent refresh + demo-fallback on connectivity failure"
```

---

## Task 12: Wire api-client listeners + auth store into app boot

**Files:**
- Modify: `frontend/src/app/providers.tsx`

- [ ] **Step 1: Add a hook that registers listeners on mount**

Replace `frontend/src/app/providers.tsx` with:

```tsx
import { ReactNode, useEffect } from "react";
import { BrowserRouter } from "react-router-dom";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "@/lib/query-client";
import { ErrorBoundary } from "@/components/feedback/ErrorBoundary";
import { registerAuthListeners } from "@/lib/api-client";
import { useAuthStore } from "@/stores/auth-store";
import { toast } from "@/lib/toast";

interface Props {
  children: ReactNode;
}

function AuthListenerBridge() {
  const qc = useQueryClient();
  const setDemoMode = useAuthStore((s) => s.setDemoMode);
  const logout = useAuthStore((s) => s.logout);

  useEffect(() => {
    registerAuthListeners({
      onDemoModeChange: (active) => setDemoMode(active),
      onLogout: () => {
        logout();
        qc.clear();
      },
      onFirstFallback: () =>
        toast.warning("Backend unreachable", {
          description:
            "Showing demo data. Some actions won't persist until the backend comes back.",
        }),
    });
  }, [qc, setDemoMode, logout]);

  return null;
}

export function AppProviders({ children }: Props) {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider delayDuration={150}>
          <BrowserRouter>
            <AuthListenerBridge />
            {children}
            <Toaster
              position="top-right"
              richColors
              closeButton
              duration={4000}
              toastOptions={{ style: { borderRadius: "12px" } }}
            />
          </BrowserRouter>
        </TooltipProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/providers.tsx
git commit -m "feat(providers): bridge api-client listeners to auth store"
```

---

## Task 13: Auth API surface

**Files:**
- Create: `frontend/src/features/auth/api/auth-api.ts`

- [ ] **Step 1: Write `features/auth/api/auth-api.ts`**

Create `frontend/src/features/auth/api/auth-api.ts`:

```ts
import { api } from "@/lib/api-client";
import type { User } from "@/types";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: "bearer";
  expires_in: number;
}

interface BackendUserDto {
  id: string;
  email: string;
  full_name: string;
  role: string;
  specialty?: string | null;
  avatar_url?: string | null;
  is_active: boolean;
  is_verified: boolean;
}

function mapUser(dto: BackendUserDto): User {
  return {
    id: dto.id,
    name: dto.full_name,
    email: dto.email,
    role: dto.role as User["role"],
    specialty: dto.specialty ?? undefined,
    avatarUrl: dto.avatar_url ?? undefined,
  };
}

export const authApi = {
  login: (payload: LoginPayload) =>
    api.post<TokenResponse>("/auth/login/json", payload, { skipAuth: true }),

  me: (demoFallback?: () => User) =>
    api
      .get<BackendUserDto>("/auth/me", {
        demoFallback: demoFallback as (() => unknown) | undefined,
      })
      .then((data) => (typeof data === "object" && "id" in data ? mapUser(data) : (data as unknown as User))),
};
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/auth/api/auth-api.ts
git commit -m "feat(auth): typed auth API surface (login, me)"
```

---

## Task 14: Auth hooks (useCurrentUser, useLogin, useLogout)

**Files:**
- Create: `frontend/src/features/auth/hooks/use-current-user.ts`
- Create: `frontend/src/features/auth/hooks/use-login.ts`
- Create: `frontend/src/features/auth/hooks/use-logout.ts`

- [ ] **Step 1: Write `use-current-user.ts`**

Create `frontend/src/features/auth/hooks/use-current-user.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { authApi } from "@/features/auth/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { QUERY_KEYS } from "@/config/constants";
import { currentUser as mockCurrentUser } from "@/mocks";

export function useCurrentUser() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const setUser = useAuthStore((s) => s.setUser);
  const demoModeActive = useAuthStore((s) => s.demoModeActive);

  const query = useQuery({
    queryKey: QUERY_KEYS.auth.me,
    queryFn: () => authApi.me(() => mockCurrentUser),
    enabled: Boolean(accessToken) || demoModeActive,
    staleTime: 5 * 60_000,
    retry: false,
  });

  useEffect(() => {
    if (query.data) setUser(query.data);
  }, [query.data, setUser]);

  return query;
}
```

- [ ] **Step 2: Write `use-login.ts`**

Create `frontend/src/features/auth/hooks/use-login.ts`:

```ts
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { authApi, type LoginPayload } from "@/features/auth/api/auth-api";
import { useAuthStore } from "@/stores/auth-store";
import { QUERY_KEYS } from "@/config/constants";
import { currentUser as mockCurrentUser } from "@/mocks";
import { env } from "@/config/env";

export function useLogin() {
  const setTokens = useAuthStore((s) => s.setTokens);
  const setUser = useAuthStore((s) => s.setUser);
  const setDemoMode = useAuthStore((s) => s.setDemoMode);
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: LoginPayload) => {
      try {
        const res = await authApi.login(payload);
        return { kind: "real" as const, res };
      } catch (err) {
        // Connectivity failure with demo fallback enabled => fake login.
        if (env.DEMO_FALLBACK && err instanceof TypeError) {
          return { kind: "demo" as const };
        }
        throw err;
      }
    },
    onSuccess: (result) => {
      if (result.kind === "demo") {
        setDemoMode(true);
        setUser(mockCurrentUser);
      } else {
        setTokens({ access: result.res.access_token, refresh: result.res.refresh_token });
      }
      qc.invalidateQueries({ queryKey: QUERY_KEYS.auth.me });
      const from = (location.state as { from?: { pathname: string } } | null)?.from
        ?.pathname;
      navigate(from && from !== "/login" ? from : "/", { replace: true });
    },
  });
}
```

- [ ] **Step 3: Write `use-logout.ts`**

Create `frontend/src/features/auth/hooks/use-logout.ts`:

```ts
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function useLogout() {
  const logout = useAuthStore((s) => s.logout);
  const qc = useQueryClient();
  const navigate = useNavigate();

  return () => {
    logout();
    qc.clear();
    navigate("/login", { replace: true });
  };
}
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/auth/hooks/
git commit -m "feat(auth): useCurrentUser, useLogin, useLogout hooks"
```

---

## Task 15: DemoBadge component

**Files:**
- Create: `frontend/src/features/auth/components/DemoBadge.tsx`

- [ ] **Step 1: Write the badge**

Create `frontend/src/features/auth/components/DemoBadge.tsx`:

```tsx
import { Cloud } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";

export function DemoBadge() {
  const demoModeActive = useAuthStore((s) => s.demoModeActive);
  if (!demoModeActive) return null;

  return (
    <div
      className="hidden md:inline-flex items-center gap-1.5 rounded-full bg-warning/10 text-warning px-2.5 py-1 text-xs font-semibold"
      title="Backend unreachable — UI is reading from demo data"
    >
      <Cloud className="size-3" />
      Demo mode
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/auth/components/DemoBadge.tsx
git commit -m "feat(auth): DemoBadge pill for backend-down state"
```

---

## Task 16: LoginForm component

**Files:**
- Create: `frontend/src/features/auth/components/LoginForm.tsx`

- [ ] **Step 1: Write the form**

Create `frontend/src/features/auth/components/LoginForm.tsx`:

```tsx
import { Loader2, Mail, Lock } from "lucide-react";
import { useForm, zodResolver, z, mapApiError } from "@/lib/form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormField } from "@/components/ui/form";
import { useLogin } from "@/features/auth/hooks/use-login";
import { ApiError } from "@/lib/api-client";

const loginSchema = z.object({
  email: z.string().email("Enter a valid email"),
  password: z.string().min(1, "Password is required"),
});
type LoginInput = z.infer<typeof loginSchema>;

export function LoginForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "robert.fox@symptra.health", password: "symptra123" },
  });
  const login = useLogin();

  const onSubmit = handleSubmit(async (values) => {
    try {
      await login.mutateAsync(values);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) {
        setError("password", { type: "server", message: "Incorrect email or password" });
      } else {
        const msg = mapApiError(err, setError);
        setError("root", { type: "server", message: msg });
      }
    }
  });

  return (
    <form onSubmit={onSubmit} className="space-y-4" noValidate>
      <FormField
        label="Email"
        htmlFor="email"
        required
        error={errors.email?.message}
      >
        <Input
          id="email"
          type="email"
          autoComplete="email"
          icon={<Mail />}
          placeholder="you@hospital.org"
          {...register("email")}
        />
      </FormField>

      <FormField
        label="Password"
        htmlFor="password"
        required
        error={errors.password?.message}
      >
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          icon={<Lock />}
          placeholder="••••••••"
          {...register("password")}
        />
      </FormField>

      {errors.root && (
        <p className="text-sm text-danger leading-tight">{errors.root.message}</p>
      )}

      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={login.isPending}
      >
        {login.isPending && <Loader2 className="size-4 animate-spin" />}
        {login.isPending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/auth/components/LoginForm.tsx
git commit -m "feat(auth): LoginForm with RHF + Zod + ApiError mapping"
```

---

## Task 17: LoginPage

**Files:**
- Create: `frontend/src/features/auth/LoginPage.tsx`
- Create: `frontend/src/features/auth/index.ts`

- [ ] **Step 1: Write the page**

Create `frontend/src/features/auth/LoginPage.tsx`:

```tsx
import { LoginForm } from "@/features/auth/components/LoginForm";

export function LoginPage() {
  return (
    <div className="min-h-screen bg-[#F5F9FF] grid lg:grid-cols-2">
      <div className="flex items-center justify-center p-6 lg:p-12">
        <div className="w-full max-w-sm space-y-8">
          <div className="flex items-center gap-3">
            <div className="size-11 rounded-full bg-primary-gradient grid place-items-center text-white shadow-glow">
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                <path
                  d="M9 2v14M2 9h14"
                  stroke="currentColor"
                  strokeWidth="2.6"
                  strokeLinecap="round"
                />
              </svg>
            </div>
            <div className="font-display text-[22px] font-bold tracking-tight">
              Symptra
            </div>
          </div>

          <div>
            <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Sign in to your Symptra account to continue.
            </p>
          </div>

          <LoginForm />

          <p className="text-xs text-muted-foreground">
            Demo creds:{" "}
            <span className="font-mono text-foreground/70">
              robert.fox@symptra.health / symptra123
            </span>
          </p>
        </div>
      </div>

      <div className="hidden lg:flex items-center justify-center bg-primary-gradient p-12">
        <div className="max-w-md text-white">
          <h2 className="text-4xl font-bold leading-tight">
            The AI-native EHR
            <br />
            doctors actually want to use.
          </h2>
          <p className="text-white/80 mt-4 leading-relaxed">
            Symptra brings clinical intelligence to your daily practice. Spend
            less time on paperwork and more time with patients.
          </p>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create auth barrel**

Create `frontend/src/features/auth/index.ts`:

```ts
export { LoginPage } from "./LoginPage";
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/auth/LoginPage.tsx frontend/src/features/auth/index.ts
git commit -m "feat(auth): LoginPage (split 2-column layout with brand panel)"
```

---

## Task 18: Route guards

**Files:**
- Create: `frontend/src/components/auth/ProtectedRoute.tsx`
- Create: `frontend/src/components/auth/PublicRoute.tsx`
- Create: `frontend/src/components/auth/index.ts`

- [ ] **Step 1: Write `ProtectedRoute.tsx`**

Create `frontend/src/components/auth/ProtectedRoute.tsx`:

```tsx
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";
import { useCurrentUser } from "@/features/auth/hooks/use-current-user";
import { PageSpinner } from "@/components/feedback/Spinner";

export function ProtectedRoute() {
  const location = useLocation();
  const accessToken = useAuthStore((s) => s.accessToken);
  const user = useAuthStore((s) => s.user);
  const demoModeActive = useAuthStore((s) => s.demoModeActive);

  const { isLoading, isError } = useCurrentUser();

  // No token and not demo mode → straight to login
  if (!accessToken && !demoModeActive) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Have a token but still resolving the user — show a spinner once
  if (isLoading && !user) return <PageSpinner label="Loading session…" />;

  // Token rejected, no user resolved, not in demo mode → bounce
  if (isError && !user && !demoModeActive) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
```

- [ ] **Step 2: Write `PublicRoute.tsx`**

Create `frontend/src/components/auth/PublicRoute.tsx`:

```tsx
import { Navigate, Outlet } from "react-router-dom";
import { useAuthStore } from "@/stores/auth-store";

export function PublicRoute() {
  const accessToken = useAuthStore((s) => s.accessToken);
  const demoModeActive = useAuthStore((s) => s.demoModeActive);

  if (accessToken || demoModeActive) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}
```

- [ ] **Step 3: Create barrel**

Create `frontend/src/components/auth/index.ts`:

```ts
export { ProtectedRoute } from "./ProtectedRoute";
export { PublicRoute } from "./PublicRoute";
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add frontend/src/components/auth/
git commit -m "feat(auth): ProtectedRoute + PublicRoute guards"
```

---

## Task 19: Update router with /login + guards

**Files:**
- Modify: `frontend/src/app/router.tsx`

- [ ] **Step 1: Replace router**

Replace `frontend/src/app/router.tsx`:

```tsx
import { Navigate, Route, Routes } from "react-router-dom";
import { Shell } from "@/components/layout/Shell";
import { ProtectedRoute, PublicRoute } from "@/components/auth";
import { LoginPage } from "@/features/auth";
import { DashboardPage } from "@/features/dashboard";
import { PatientsPage, PatientProfilePage } from "@/features/patients";
import { InsightsPage } from "@/features/analytics";
import { AppointmentsPage } from "@/features/appointments";
import { MobilePage } from "@/features/mobile";
import { ROUTES } from "@/config/constants";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicRoute />}>
        <Route path="/login" element={<LoginPage />} />
      </Route>

      <Route element={<ProtectedRoute />}>
        <Route element={<Shell />}>
          <Route path={ROUTES.dashboard} element={<DashboardPage />} />
          <Route path={ROUTES.patients} element={<PatientsPage />} />
          <Route path="/patients/:patientId" element={<PatientProfilePage />} />
          <Route path={ROUTES.insights} element={<InsightsPage />} />
          <Route path={ROUTES.appointments} element={<AppointmentsPage />} />
          <Route path={ROUTES.docs} element={<Placeholder title="Docs" />} />
          <Route path={ROUTES.team} element={<Placeholder title="Team" />} />
          <Route path={ROUTES.mobile} element={<MobilePage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
    </Routes>
  );
}

function Placeholder({ title }: { title: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border bg-surface-subtle p-12 text-center">
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="text-sm text-muted-foreground mt-1">
        This module is part of the platform scaffold and will be wired to live data shortly.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Manual smoke check**

`cd frontend && npm run dev` → visit `http://localhost:5173`.
Expected: you land on `/login`. With the backend NOT running, click Sign in → toast warns "Backend unreachable", a Demo mode badge will show after navigating to `/`. With the backend running, real creds work and you land on `/`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/router.tsx
git commit -m "feat(router): /login route + ProtectedRoute/PublicRoute guards"
```

---

## Task 20: Update Topbar (DemoBadge + real logout + notifications popover stub)

**Files:**
- Modify: `frontend/src/components/layout/Topbar.tsx`

- [ ] **Step 1: Replace Topbar**

Replace `frontend/src/components/layout/Topbar.tsx`:

```tsx
import { Bell, ChevronDown, LogOut, Settings, User as UserIcon } from "lucide-react";
import { NavLink } from "react-router-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import * as Popover from "@radix-ui/react-popover";
import { UserAvatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";
import { useLogout } from "@/features/auth/hooks/use-logout";
import { DemoBadge } from "@/features/auth/components/DemoBadge";
import { currentUser as mockUser } from "@/mocks";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/", label: "Dashboard" },
  { to: "/patients", label: "Patients" },
  { to: "/insights", label: "Insights" },
  { to: "/appointments", label: "Appointments" },
  { to: "/docs", label: "Docs" },
  { to: "/team", label: "Team" },
  { to: "/mobile", label: "Mobile" },
];

export function Topbar() {
  const user = useAuthStore((s) => s.user) ?? mockUser;
  const logout = useLogout();

  return (
    <header className="rounded-[28px] bg-white border border-border/70 shadow-[0_8px_24px_rgba(17,24,39,0.06)]">
      <div className="flex items-center justify-between gap-4 px-5 sm:px-6 lg:px-7 3xl:px-8 h-[72px]">
        <div className="flex items-center gap-3 min-w-fit">
          <div className="size-11 rounded-full bg-primary-gradient grid place-items-center text-white shadow-glow">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
              <path
                d="M9 2v14M2 9h14"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <div className="font-display text-[22px] font-bold tracking-tight">Symptra</div>
        </div>

        <nav className="hidden lg:flex items-center gap-1 mx-auto bg-[#F1F4F9] rounded-full p-1">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              className={({ isActive }) =>
                cn(
                  "px-4 xl:px-5 py-2 rounded-full text-[14px] font-medium transition-all",
                  isActive
                    ? "bg-slate-900 text-white shadow-soft"
                    : "text-slate-600 hover:text-slate-900 hover:bg-white/60"
                )
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="flex items-center gap-2 min-w-fit">
          <DemoBadge />

          <Popover.Root>
            <Popover.Trigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative size-10 rounded-full bg-[#F1F4F9] hover:bg-[#E6EBF2] text-slate-700"
                aria-label="Notifications"
              >
                <Bell className="size-[18px]" />
                <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 grid place-items-center rounded-full bg-danger text-[10px] font-bold text-white ring-2 ring-white">
                  3
                </span>
              </Button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                sideOffset={8}
                align="end"
                className="z-50 w-80 rounded-2xl bg-white shadow-elev border border-border p-4 animate-fade-in"
              >
                <h3 className="font-semibold text-sm mb-2">Notifications</h3>
                <p className="text-xs text-muted-foreground">
                  Real-time notifications arrive in Phase C. Until then this is a
                  placeholder.
                </p>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>

          <Button
            variant="ghost"
            size="icon"
            className="size-10 rounded-full bg-[#F1F4F9] hover:bg-[#E6EBF2] text-slate-700"
            aria-label="Settings"
          >
            <Settings className="size-[18px]" />
          </Button>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button className="flex items-center gap-2.5 pl-2 ml-1 h-10 ring-focus rounded-full">
                <UserAvatar
                  name={user.name}
                  size="md"
                  className="bg-amber-100 ring-2 ring-amber-50"
                />
                <div className="hidden sm:flex flex-col leading-tight text-left">
                  <span className="text-sm font-bold">{user.name}</span>
                  <span className="text-xs text-muted-foreground capitalize">
                    {user.role}
                  </span>
                </div>
                <ChevronDown className="size-4 text-muted-foreground" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                sideOffset={8}
                align="end"
                className="z-50 w-56 rounded-2xl bg-white shadow-elev border border-border p-1.5 animate-fade-in"
              >
                <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-secondary cursor-pointer outline-none">
                  <UserIcon className="size-4 text-muted-foreground" />
                  Profile
                </DropdownMenu.Item>
                <DropdownMenu.Item className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-secondary cursor-pointer outline-none">
                  <Settings className="size-4 text-muted-foreground" />
                  Settings
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="h-px bg-border my-1" />
                <DropdownMenu.Item
                  onSelect={() => logout()}
                  className="flex items-center gap-2 px-3 py-2 text-sm rounded-xl hover:bg-danger/10 text-danger cursor-pointer outline-none"
                >
                  <LogOut className="size-4" />
                  Sign out
                </DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>
      </div>
    </header>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Manual smoke**

Dev server → click the avatar → dropdown shows Profile / Settings / Sign out. Click Sign out → back to `/login`, query cache cleared.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/layout/Topbar.tsx
git commit -m "feat(topbar): DemoBadge + real logout + notifications popover stub"
```

---

## Task 21: Patients API + hooks

**Files:**
- Create: `frontend/src/features/patients/api/patients-api.ts`
- Create: `frontend/src/features/patients/hooks/use-patients.ts`
- Create: `frontend/src/features/patients/hooks/use-patient.ts`

- [ ] **Step 1: Write `patients-api.ts`**

Create `frontend/src/features/patients/api/patients-api.ts`:

```ts
import { api } from "@/lib/api-client";
import type { Patient } from "@/types";

interface BackendPatientDto {
  id: string;
  mrn: string;
  first_name: string;
  last_name: string;
  sex: "F" | "M" | "O";
  dob: string;
  city?: string | null;
  avatar_url?: string | null;
  procedure?: string | null;
  procedure_date?: string | null;
  asa?: "I" | "II" | "III" | "IV" | null;
  icu_needed: boolean;
  status: Patient["status"];
  risk: Patient["risk"];
  risk_score: number;
  tags?: string[] | null;
  assigned_physician_id: string | null;
}

interface PageDto<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface PatientFilters {
  q?: string;
  status?: Patient["status"];
  risk?: Patient["risk"];
  page?: number;
  page_size?: number;
}

export interface PatientPage {
  items: Patient[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

function mapPatient(dto: BackendPatientDto): Patient {
  const age = computeAge(dto.dob);
  return {
    id: dto.id,
    mrn: dto.mrn,
    name: `${dto.first_name} ${dto.last_name}`,
    sex: dto.sex,
    dob: dto.dob,
    city: dto.city ?? undefined,
    avatarUrl: dto.avatar_url ?? undefined,
    age,
    procedure: dto.procedure ?? "",
    status: dto.status,
    procedureDate: dto.procedure_date ?? "",
    assignedPhysician: { name: "—" },
    tags: dto.tags ?? [],
    risk: dto.risk,
    asa: dto.asa ?? undefined,
    icu: dto.icu_needed,
  };
}

function computeAge(dob: string): number {
  const birth = new Date(dob);
  const diff = Date.now() - birth.getTime();
  return Math.floor(diff / (365.25 * 24 * 60 * 60 * 1000));
}

export const patientsApi = {
  list: async (
    filters: PatientFilters,
    fallback?: { items: Patient[]; total: number }
  ): Promise<PatientPage> => {
    const data = await api.get<PageDto<BackendPatientDto>>("/patients", {
      searchParams: {
        q: filters.q,
        status: filters.status,
        risk: filters.risk,
        page: filters.page ?? 1,
        page_size: filters.page_size ?? 20,
      },
      demoFallback: fallback
        ? () => ({
            items: fallback.items.map((p) => ({
              id: p.id,
              mrn: p.mrn,
              first_name: p.name.split(" ")[0] ?? "",
              last_name: p.name.split(" ").slice(1).join(" "),
              sex: p.sex,
              dob: p.dob,
              city: p.city ?? null,
              avatar_url: p.avatarUrl ?? null,
              procedure: p.procedure,
              procedure_date: p.procedureDate,
              asa: p.asa ?? null,
              icu_needed: Boolean(p.icu),
              status: p.status,
              risk: p.risk,
              risk_score: 0,
              tags: p.tags ?? null,
              assigned_physician_id: null,
            })),
            total: fallback.total,
            page: filters.page ?? 1,
            page_size: filters.page_size ?? 20,
            pages: Math.max(1, Math.ceil(fallback.total / (filters.page_size ?? 20))),
          })
        : undefined,
    });
    return {
      items: data.items.map(mapPatient),
      total: data.total,
      page: data.page,
      page_size: data.page_size,
      pages: data.pages,
    };
  },

  get: async (id: string, fallback?: Patient): Promise<Patient> => {
    const dto = await api.get<BackendPatientDto>(`/patients/${id}`, {
      demoFallback: fallback
        ? () => ({
            id: fallback.id,
            mrn: fallback.mrn,
            first_name: fallback.name.split(" ")[0] ?? "",
            last_name: fallback.name.split(" ").slice(1).join(" "),
            sex: fallback.sex,
            dob: fallback.dob,
            city: fallback.city ?? null,
            avatar_url: fallback.avatarUrl ?? null,
            procedure: fallback.procedure,
            procedure_date: fallback.procedureDate,
            asa: fallback.asa ?? null,
            icu_needed: Boolean(fallback.icu),
            status: fallback.status,
            risk: fallback.risk,
            risk_score: 0,
            tags: fallback.tags ?? null,
            assigned_physician_id: null,
          })
        : undefined,
    });
    return mapPatient(dto);
  },
};
```

- [ ] **Step 2: Write `use-patients.ts`**

Create `frontend/src/features/patients/hooks/use-patients.ts`:

```ts
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { patientsApi, type PatientFilters } from "@/features/patients/api/patients-api";
import { QUERY_KEYS, PAGE_SIZE } from "@/config/constants";
import { patients as mockPatients } from "@/mocks";

export function usePatients(filters: PatientFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.patients.list(filters),
    queryFn: () =>
      patientsApi.list(filters, {
        items: applyClientFilters(mockPatients, filters),
        total: applyClientFilters(mockPatients, filters).length,
      }),
    placeholderData: keepPreviousData,
    staleTime: 30_000,
  });
}

function applyClientFilters(items: typeof mockPatients, f: PatientFilters) {
  const q = f.q?.toLowerCase().trim();
  let out = items;
  if (q) {
    out = out.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.mrn.includes(q) ||
        p.procedure.toLowerCase().includes(q)
    );
  }
  if (f.status) out = out.filter((p) => p.status === f.status);
  if (f.risk) out = out.filter((p) => p.risk === f.risk);
  const page = f.page ?? 1;
  const size = f.page_size ?? PAGE_SIZE;
  return out.slice((page - 1) * size, page * size);
}
```

- [ ] **Step 3: Write `use-patient.ts`**

Create `frontend/src/features/patients/hooks/use-patient.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { patientsApi } from "@/features/patients/api/patients-api";
import { QUERY_KEYS } from "@/config/constants";
import { patients as mockPatients } from "@/mocks";

export function usePatient(id: string | undefined) {
  return useQuery({
    queryKey: id ? QUERY_KEYS.patients.byId(id) : ["patients", "none"],
    queryFn: () => {
      if (!id) throw new Error("patientId required");
      const fallback = mockPatients.find((p) => p.id === id) ?? mockPatients[0];
      return patientsApi.get(id, fallback);
    },
    enabled: Boolean(id),
  });
}
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/patients/api/ frontend/src/features/patients/hooks/
git commit -m "feat(patients): API + hooks layer (list, get) with demo fallback"
```

---

## Task 22: Wire PatientsPage to real data

**Files:**
- Modify: `frontend/src/features/patients/PatientsPage.tsx`

- [ ] **Step 1: Replace `PatientsPage.tsx`**

Replace `frontend/src/features/patients/PatientsPage.tsx`:

```tsx
import { useState } from "react";
import {
  ArrowDownAZ,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  LayoutGrid,
  Plus,
  Rows3,
  Search,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ErrorBanner } from "@/components/ui/error-banner";
import { TableSkeleton } from "@/components/ui/table-skeleton";
import { PatientTable } from "@/features/patients/components/PatientTable";
import { PatientCardGrid } from "@/features/patients/components/PatientCardGrid";
import { usePatients } from "@/features/patients/hooks/use-patients";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

export function PatientsPage() {
  const viewMode = useAppStore((s) => s.viewMode);
  const setViewMode = useAppStore((s) => s.setViewMode);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const { data, isLoading, isError, error, refetch, isFetching } = usePatients({
    q: query || undefined,
    page,
    page_size: 20,
  });

  return (
    <>
      <PageHeader
        title="All patients view"
        right={
          <>
            <div className="w-52">
              <Input
                icon={<Search className="size-3.5" />}
                iconPosition="right"
                iconBg
                placeholder="Search…"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setPage(1);
                }}
                className="bg-white"
              />
            </div>
            <Button variant="secondary" className="h-10 pl-1.5 gap-2">
              <span className="grid place-items-center size-7 rounded-full bg-[#F1F4F9] text-foreground/70">
                <Filter className="size-3.5" />
              </span>
              Filter
            </Button>
            <Button variant="secondary" className="h-10 pl-1.5 gap-2">
              <span className="grid place-items-center size-7 rounded-full bg-[#F1F4F9] text-foreground/70">
                <ArrowDownAZ className="size-3.5" />
              </span>
              Sort by
            </Button>
            <div className="flex items-center bg-white border border-border rounded-full p-1 h-10 shadow-soft">
              <button
                onClick={() => setViewMode("table")}
                className={cn(
                  "size-8 grid place-items-center rounded-full transition",
                  viewMode === "table"
                    ? "bg-primary-gradient text-white shadow-glow"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Table view"
              >
                <Rows3 className="size-3.5" />
              </button>
              <button
                onClick={() => setViewMode("cards")}
                className={cn(
                  "size-8 grid place-items-center rounded-full transition",
                  viewMode === "cards"
                    ? "bg-primary-gradient text-white shadow-glow"
                    : "text-muted-foreground hover:text-foreground"
                )}
                aria-label="Card view"
              >
                <LayoutGrid className="size-3.5" />
              </button>
            </div>
            <Button variant="secondary" className="h-10">
              <Download className="size-4" /> Export data
            </Button>
            <Button className="h-10">
              <Plus className="size-4" /> New patient
            </Button>
          </>
        }
      />

      {isLoading && <TableSkeleton rows={8} cols={9} />}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load patients"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && data && (
        <>
          {viewMode === "table" ? (
            <PatientTable data={data.items} />
          ) : (
            <PatientCardGrid data={data.items} />
          )}

          <div className="flex items-center justify-between mt-6 text-sm text-muted-foreground">
            <span>
              Showing {data.items.length} of {data.total}
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="size-9 rounded-full"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={data.page <= 1}
              >
                <ChevronLeft className="size-3.5" />
              </Button>
              <span className="px-3 py-1 rounded-full bg-white border border-border text-xs">
                Page <strong className="text-foreground">{data.page}</strong> of {data.pages}
              </span>
              <Button
                size="icon"
                className="size-9 rounded-full"
                onClick={() => setPage((p) => Math.min(data.pages, p + 1))}
                disabled={data.page >= data.pages}
              >
                <ChevronRight className="size-3.5" />
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Manual smoke**

Dev server → `/patients` → table loads from backend if running, falls back to mocks otherwise. Type in search → debounced filter. Page next/prev → query refetches.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/patients/PatientsPage.tsx
git commit -m "feat(patients): wire PatientsPage to real backend via usePatients"
```

---

## Task 23: Wire PatientProfilePage to real data

**Files:**
- Modify: `frontend/src/features/patients/PatientProfilePage.tsx`

- [ ] **Step 1: Replace `PatientProfilePage.tsx`**

Replace `frontend/src/features/patients/PatientProfilePage.tsx`:

```tsx
import { useNavigate, useParams } from "react-router-dom";
import { PageHeader } from "@/components/layout/PageHeader";
import { ErrorBanner } from "@/components/ui/error-banner";
import { PageSpinner } from "@/components/feedback/Spinner";
import { PatientHeader } from "@/features/patients/components/PatientHeader";
import { KeyClinicalOverview } from "@/features/patients/components/KeyClinicalOverview";
import { KeyDocuments } from "@/features/patients/components/KeyDocuments";
import { ImportantAlerts } from "@/features/patients/components/ImportantAlerts";
import { ChecklistCard } from "@/features/patients/components/Checklist";
import { Timeline } from "@/features/patients/components/Timeline";
import { Vitals } from "@/features/patients/components/Vitals";
import { AiSummary } from "@/features/patients/components/AiSummary";
import { SoapNotesCard } from "@/features/patients/components/SoapNotesCard";
import { MedicationsCard } from "@/features/patients/components/Medications";
import { Labs } from "@/features/patients/components/Labs";
import { ClinicalActions } from "@/features/patients/components/ClinicalActions";
import { usePatient } from "@/features/patients/hooks/use-patient";
import { soapNotes } from "@/mocks";

export function PatientProfilePage() {
  const { patientId } = useParams<{ patientId: string }>();
  const navigate = useNavigate();
  const { data: patient, isLoading, isError, error, refetch, isFetching } = usePatient(
    patientId
  );

  return (
    <>
      <PageHeader
        title="Patient information"
        back
        onBack={() => navigate(-1)}
        right={
          patient && (
            <span className="text-xs text-muted-foreground">MRN {patient.mrn}</span>
          )
        }
      />

      {isLoading && <PageSpinner label="Loading patient…" />}

      {isError && !isLoading && (
        <ErrorBanner
          title="Couldn't load patient"
          message={error instanceof Error ? error.message : "Please try again."}
          onRetry={() => refetch()}
          retrying={isFetching}
        />
      )}

      {!isLoading && !isError && patient && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          <div className="lg:col-span-4 space-y-4">
            <PatientHeader patient={patient} />
            <ImportantAlerts />
          </div>
          <div className="lg:col-span-5 space-y-4">
            <KeyClinicalOverview />
            <AiSummary
              summary={
                soapNotes[0].aiSummary ?? "AI summary unavailable — please regenerate."
              }
            />
            <SoapNotesCard />
            <Vitals />
            <MedicationsCard />
          </div>
          <div className="lg:col-span-3 space-y-4">
            <KeyDocuments />
            <ClinicalActions />
            <Timeline />
          </div>
          <div className="lg:col-span-12">
            <ChecklistCard />
          </div>
          <div className="lg:col-span-12">
            <Labs />
          </div>
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Manual smoke**

Dev server → `/patients/p-1012` → page loads patient details. Loading spinner shows briefly. Backend down → falls back to mock patient.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/patients/PatientProfilePage.tsx
git commit -m "feat(patients): wire PatientProfilePage to real backend via usePatient"
```

---

## Task 24: Appointments API + hook

**Files:**
- Create: `frontend/src/features/appointments/api/appointments-api.ts`
- Create: `frontend/src/features/appointments/hooks/use-upcoming-appointments.ts`

- [ ] **Step 1: Write the API**

Create `frontend/src/features/appointments/api/appointments-api.ts`:

```ts
import { api } from "@/lib/api-client";
import type { Appointment } from "@/types";

interface BackendAppointmentDto {
  id: string;
  patient_id: string;
  physician_id: string | null;
  type: Appointment["type"];
  status: Appointment["status"];
  starts_at: string;
  duration_minutes: number;
  room?: string | null;
  reason?: string | null;
}

function mapAppointment(dto: BackendAppointmentDto): Appointment {
  const date = new Date(dto.starts_at);
  return {
    id: dto.id,
    patientId: dto.patient_id,
    patientName: "—",
    type: dto.type,
    status: dto.status,
    date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    time: date.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }),
    duration: dto.duration_minutes,
    physician: "—",
    room: dto.room ?? undefined,
  };
}

export const appointmentsApi = {
  listUpcoming: async (
    limit = 50,
    fallback?: Appointment[]
  ): Promise<Appointment[]> => {
    const data = await api.get<BackendAppointmentDto[]>("/appointments", {
      searchParams: { limit },
      demoFallback: fallback
        ? () =>
            fallback.map((a) => ({
              id: a.id,
              patient_id: a.patientId,
              physician_id: null,
              type: a.type,
              status: a.status,
              starts_at: new Date().toISOString(),
              duration_minutes: a.duration,
              room: a.room ?? null,
              reason: null,
            }))
        : undefined,
    });
    return data.map(mapAppointment);
  },
};
```

- [ ] **Step 2: Write the hook**

Create `frontend/src/features/appointments/hooks/use-upcoming-appointments.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { appointmentsApi } from "@/features/appointments/api/appointments-api";
import { QUERY_KEYS } from "@/config/constants";
import { appointments as mockAppointments } from "@/mocks";

export function useUpcomingAppointments(limit = 50) {
  return useQuery({
    queryKey: QUERY_KEYS.appointments.upcoming,
    queryFn: () => appointmentsApi.listUpcoming(limit, mockAppointments),
    staleTime: 60_000,
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/appointments/api/ frontend/src/features/appointments/hooks/
git commit -m "feat(appointments): API + useUpcomingAppointments hook"
```

---

## Task 25: Wire UpcomingAppointments widget

**Files:**
- Modify: `frontend/src/features/dashboard/components/UpcomingAppointments.tsx`

- [ ] **Step 1: Replace `UpcomingAppointments.tsx`**

Replace `frontend/src/features/dashboard/components/UpcomingAppointments.tsx`:

```tsx
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  ChevronsUpDown,
  MoreVertical,
  Phone,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserAvatar } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useUpcomingAppointments } from "@/features/appointments/hooks/use-upcoming-appointments";
import { cn } from "@/lib/utils";

const days = Array.from({ length: 18 }).map((_, i) => 14 + i);

export function UpcomingAppointments() {
  const { data, isLoading } = useUpcomingAppointments(8);

  return (
    <Card className="h-full">
      <CardHeader className="flex flex-row items-center justify-between pb-3 gap-2 flex-wrap">
        <CardTitle className="flex items-center gap-2 text-base">
          <span className="size-8 rounded-xl bg-primary/10 grid place-items-center text-primary">
            <Calendar className="size-4" />
          </span>
          Upcoming appointments
        </CardTitle>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <Legend color="bg-primary" label="Available slots" />
          <Legend color="bg-slate-900" label="Selected" />
          <Legend color="bg-slate-200" label="Unavailable" />
          <button className="text-sm font-medium text-primary hover:underline ml-2">
            View more
          </button>
        </div>
      </CardHeader>
      <CardContent className="pb-5">
        <div className="flex items-center gap-1.5 mb-5 overflow-x-auto scrollbar-hide">
          <Button variant="ghost" size="icon" className="size-9 shrink-0">
            <ChevronLeft className="size-4" />
          </Button>
          {days.map((d) => (
            <button
              key={d}
              className={cn(
                "size-10 rounded-full text-[13px] font-semibold shrink-0 transition border",
                d === 22
                  ? "bg-primary text-white border-primary shadow-glow"
                  : "bg-white border-border text-foreground hover:bg-primary/5"
              )}
            >
              {d}
            </button>
          ))}
          <Button variant="ghost" size="icon" className="size-9 shrink-0">
            <ChevronRight className="size-4" />
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground text-left">
                <Th>Patient</Th>
                <Th>Treatment</Th>
                <Th>Status</Th>
                <Th>Date</Th>
                <Th>Time</Th>
                <th className="font-medium py-3 text-right pr-2">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {isLoading &&
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={6} className="py-2">
                      <Skeleton className="h-10 rounded-xl" />
                    </td>
                  </tr>
                ))}
              {!isLoading &&
                data?.map((a) => (
                  <tr key={a.id} className="hover:bg-surface-subtle transition">
                    <td className="py-3.5">
                      <div className="flex items-center gap-2.5">
                        <UserAvatar name={a.patientName} size="md" />
                        <span className="font-semibold text-[14px]">
                          {a.patientName}
                        </span>
                      </div>
                    </td>
                    <td className="py-3.5 capitalize text-foreground/80">{a.type}</td>
                    <td className="py-3.5">
                      <Badge
                        variant={
                          a.status === "confirmed"
                            ? "success"
                            : a.status === "cancelled"
                            ? "danger"
                            : "warning"
                        }
                        dot
                        size="sm"
                        className="capitalize"
                      >
                        {a.status}
                      </Badge>
                    </td>
                    <td className="py-3.5 text-foreground/80">{a.date}</td>
                    <td className="py-3.5 text-foreground/80">{a.time}</td>
                    <td className="py-3.5">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" className="size-9 rounded-full">
                          <Phone className="size-3.5" />
                        </Button>
                        <Button variant="ghost" size="icon" className="size-9">
                          <MoreVertical className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="font-medium py-3">
      <button className="inline-flex items-center gap-1 hover:text-foreground transition">
        {children}
        <ChevronsUpDown className="size-3 opacity-60" />
      </button>
    </th>
  );
}

function Legend({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-2 w-2 rounded-full", color)} />
      <span>{label}</span>
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/dashboard/components/UpcomingAppointments.tsx
git commit -m "feat(dashboard): wire UpcomingAppointments widget to real data"
```

---

## Task 26: Wire Dashboard greeting to current user

**Files:**
- Modify: `frontend/src/features/dashboard/DashboardPage.tsx`

- [ ] **Step 1: Use current user's first name in the greeting**

Find the `<PageHeader title="Welcome back, Dr. Robert! ☀️" …>` line in `frontend/src/features/dashboard/DashboardPage.tsx` and replace the title with a dynamic version. Replace the file's import block and the `<PageHeader …>` call:

Add this import near the top:

```tsx
import { useAuthStore } from "@/stores/auth-store";
```

Replace the `<PageHeader … />` call:

```tsx
<PageHeader
  title={`Welcome back, ${useGreetingName()}! ☀️`}
  right={
    <>
      <Input
        placeholder="Search…"
        icon={<Search className="size-4" />}
        className="w-48 lg:w-56 h-10"
      />
      <Button variant="secondary" className="h-10">
        <CalendarDays className="size-4" /> Monthly
      </Button>
      <Button variant="secondary" className="h-10">
        <Download className="size-4" /> Export data
      </Button>
    </>
  }
/>
```

Add this helper function near the bottom of the file (outside the `DashboardPage` function):

```tsx
function useGreetingName() {
  const user = useAuthStore((s) => s.user);
  if (!user) return "Doctor";
  const first = user.name.replace(/^Dr\.\s*/, "").split(" ")[0];
  return `Dr. ${first}`;
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/dashboard/DashboardPage.tsx
git commit -m "feat(dashboard): greeting reads current user from auth store"
```

---

## Task 27: Analytics snapshot hook (for later phases)

**Files:**
- Create: `frontend/src/features/analytics/api/analytics-api.ts`
- Create: `frontend/src/features/analytics/hooks/use-analytics-snapshot.ts`

- [ ] **Step 1: Write the API**

Create `frontend/src/features/analytics/api/analytics-api.ts`:

```ts
import { api } from "@/lib/api-client";

interface KpiCardDto {
  label: string;
  value: number;
  delta?: number | null;
  unit?: string | null;
  hint?: string | null;
}
interface TrendPointDto {
  label: string;
  value?: number | null;
  series?: Record<string, number> | null;
}
interface BottleneckRowDto {
  name: string;
  percent_affected: string;
  trend: string;
  direction: string;
  impact: string;
  suggested_fix: string;
}
interface HeatmapCellDto {
  body_part: string;
  values: number[];
}

export interface DashboardSnapshot {
  kpis: KpiCardDto[];
  bottlenecks: BottleneckRowDto[];
  complication_trend: TrendPointDto[];
  proms_trend: TrendPointDto[];
  heatmap: HeatmapCellDto[];
}

export const analyticsApi = {
  snapshot: (fallback?: DashboardSnapshot) =>
    api.get<DashboardSnapshot>("/analytics/snapshot", {
      demoFallback: fallback ? () => fallback : undefined,
    }),
};
```

- [ ] **Step 2: Write the hook**

Create `frontend/src/features/analytics/hooks/use-analytics-snapshot.ts`:

```ts
import { useQuery } from "@tanstack/react-query";
import { analyticsApi } from "@/features/analytics/api/analytics-api";
import { QUERY_KEYS } from "@/config/constants";
import { bottlenecks, complicationTrend, promsTrend, heatmapData } from "@/mocks";

export function useAnalyticsSnapshot() {
  return useQuery({
    queryKey: QUERY_KEYS.analytics.snapshot,
    queryFn: () =>
      analyticsApi.snapshot({
        kpis: [
          { label: "Total patients", value: 598, delta: 2.4 },
          { label: "Ready for OR", value: 12, delta: 1.1 },
          { label: "High-risk", value: 8, delta: -0.3 },
          { label: "Confirmed appts", value: 64, delta: 4.2 },
        ],
        bottlenecks: bottlenecks.map((b) => ({
          name: b.name,
          percent_affected: b.percent,
          trend: b.trend,
          direction: b.direction,
          impact: b.impact,
          suggested_fix: b.fix,
        })),
        complication_trend: complicationTrend.map((c) => ({
          label: c.label,
          value: (c as { value?: number }).value ?? null,
        })),
        proms_trend: promsTrend.map((p) => ({
          label: p.label,
          series: {
            satisfaction: Number(p.satisfaction),
            mobility: Number(p.mobility),
            pain: Number(p.pain),
          },
        })),
        heatmap: heatmapData.map((h) => ({ body_part: h.body, values: h.values })),
      }),
    staleTime: 5 * 60_000,
  });
}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/analytics/api/ frontend/src/features/analytics/hooks/
git commit -m "feat(analytics): snapshot hook ready for Insights wiring"
```

---

## Task 28: End-to-end smoke test against acceptance criteria

**Files:** (none — verification only)

- [ ] **Step 1: Boot the backend**

Open a terminal:

```bash
cd /home/ttpl-lnv-0264/Modern-EHR-Design/modern-ehr
docker compose up db redis -d
cd backend
source .venv/bin/activate
python -m scripts.seed
uvicorn app.main:app --reload --port 8000
```

Expected: API docs at `http://localhost:8000/docs`, seed prints "Seeded."

- [ ] **Step 2: Boot the frontend**

In a second terminal:

```bash
cd /home/ttpl-lnv-0264/Modern-EHR-Design/modern-ehr/frontend
npm run dev
```

Expected: dev server at `http://localhost:5173`.

- [ ] **Step 3: Walk the acceptance criteria**

For each item, verify and check the box:

- [ ] AC1: Visit `/` while logged out → redirected to `/login`
- [ ] AC2: Submit `robert.fox@symptra.health` / `symptra123` → land on `/`, no errors
- [ ] AC3: Topbar shows "Dr. Robert Fox" and the role
- [ ] AC4: `/patients` shows real patients from `/api/v1/patients` (devtools Network tab shows the request)
- [ ] AC5: Click any patient → `/patients/:id` loads their real data
- [ ] AC6: Type in search box → URL doesn't change but the query refetches; pagination next/prev refetches
- [ ] AC7: `docker compose stop backend` (or kill the uvicorn process) → reload `/patients` → mocks render, Demo badge appears in topbar, one warning toast
- [ ] AC8: Click avatar → Sign out → land on `/login`; devtools Application/Storage shows tokens cleared
- [ ] AC9: With backend up, edit a JWT in localStorage to break it → reload → silent refresh attempt, then fall back to `/login` (since the demo refresh-token won't accept a tampered one)
- [ ] AC10: Submit wrong password → inline error "Incorrect email or password" appears under the password field
- [ ] AC11: Run `npm run typecheck` → exit 0; run `npm run lint` → exit 0 (warnings ok)
- [ ] AC12: `git log --oneline 30` shows the per-concern commits from this plan

- [ ] **Step 4: Commit the smoke test report (if you want a paper trail)**

Optional — write `docs/superpowers/runs/2026-05-26-foundation-smoke.md` with checked boxes from above and commit it. Otherwise just close this task.

---

## Self-review notes

**Spec coverage check:** I cross-walked every section of the spec to a task:

- Section 1 (state) → Tasks 10, 14 (auth-store, hooks via React Query)
- Section 2 (auth lifecycle) → Tasks 11, 13, 14, 18, 19
- Section 3 (demo-mode fallback) → Tasks 11, 12, 13, 14
- Section 4 (API layer organization) → Tasks 13, 14, 21, 24, 27
- Section 5 (query keys) → Task 3
- Section 6 (mutation patterns) → Deferred (no mutations land in Phase A beyond login; create/update/delete patient land in Phase B)
- Section 7 (forms) → Tasks 6, 7, 16
- Section 8 (error UX) → Tasks 8, 16, 22, 23
- Section 9 (loading states) → Tasks 9, 22, 23, 25
- Section 10 (topbar) → Task 20
- Section 11 (routing) → Tasks 18, 19
- File-level delta → all listed files covered
- Acceptance criteria → Task 28 walks every one

**Placeholder scan:** clean. No TBD / TODO / "implement later" / "similar to" / "add error handling" patterns.

**Type consistency:** `Patient`, `User`, `Appointment` types come from `@/types`; backend DTOs are mapped via `mapPatient` / `mapUser` / `mapAppointment` consistently. `BackendUserDto` shape matches the FastAPI `UserOut` schema (`full_name`, `avatar_url`, `is_active`, `is_verified`).

**Sequencing:** Tasks 1-3 are setup, 4-9 are cross-cutting components, 10-19 build auth + routing, 20 ties topbar in, 21-27 wire features, 28 verifies. No task depends on a later task.

**Out-of-scope landmarks (deferred to B/C/D, not in this plan):**
- Patient create/update/delete mutations
- AI tile wiring (`/ai/summary`, `/ai/risk`, `/ai/ask`)
- WebSocket subscription
- Full Insights/Analytics page wiring (Task 27 builds the hook but doesn't replace mock arrays in InsightsPage)
- New screens (Docs, Team, Settings, Profile)
- Frontend test runner

---

**Total: 28 tasks · ~28 commits. Each task independently committable and verifiable.**
