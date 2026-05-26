# Padmavat Foundation Integration — Design

**Date:** 2026-05-26
**Scope:** Sub-project A (foundation only)
**Author:** Claude + Bajrang

This is the first of four sub-projects that turn the Padmavat scaffold into a fully functional product. Phase A builds the plumbing that everything else depends on. Phases B (Patient feature wired + Dashboard polish), C (AI + WebSockets), and D (new screens) each get their own design doc later.

## Goal

Make the React frontend talk to the FastAPI backend end-to-end with real auth, real data, and real error handling, while preserving the ability to demo the app with the backend down.

After this phase ships, a developer should be able to:

1. `docker compose up` → land on `/login` → sign in with `robert.fox@padmavat.health / padmavat123`
2. See the Dashboard render with a real `Welcome back, Dr. Robert Fox`
3. Navigate to `/patients`, see the real seeded patients from the DB
4. Click a patient → see their real profile
5. Stop the backend → the app falls back to mock data, shows a "Demo mode" badge, no crashes

Out-of-scope: AI tile wiring, WebSocket subscription, Docs/Team/Settings/Profile screens, Dashboard card visual polish. Those land in B/C/D.

## Non-goals

- HIPAA-compliant token storage (would need httpOnly cookie + CSRF; we use localStorage for the demo)
- SSR
- Mobile-app auth flow
- Email verification flow
- Password reset flow (backend stub exists, UI deferred to later)
- Multi-tenant / org-switcher

## Architecture decisions

### 1. State

| Concern | Choice | Reasoning |
|---|---|---|
| Server cache | TanStack React Query | Already a dependency, owns the cache and refetch lifecycle |
| Client/UI state | Zustand | Already a dependency, used for sidebar/theme today; auth state slots in |
| Form state | React Hook Form + Zod | Industry standard, types derive from schema, ApiError → setError feedback path |
| Persisted state | `localStorage` via `STORAGE_KEYS` | Already defined in `config/constants.ts` |
| Toasts | Sonner | Already installed |

### 2. Auth lifecycle

```
[anonymous] ──submit login──► POST /auth/login/json
                                  │
                              tokens returned
                                  │
                       store {access, refresh} → localStorage
                       set authStore.user = me() result
                                  │
                              navigate to from-URL || /
                                  │
[authenticated] ──any API call──► api-client attaches Bearer
                                  │
                              if 401:
                                  │
                              POST /auth/refresh → new access
                                  │
                              retry original request ONCE
                                  │
                              if refresh fails → authStore.logout() → /login
```

Refresh logic lives in the api-client interceptor. React-level code never sees the refresh — it sees either a successful response or a final 401 (which a top-level effect catches and triggers logout).

### 3. Demo-mode fallback

The fallback is keyed off a single boolean: `env.DEMO_FALLBACK`. Default `true` in dev, `false` in prod (controlled by `VITE_DEMO_FALLBACK`).

When `true`:

- `api.get/post/…` accepts an optional `demoFallback: () => T` argument
- The client **only** falls back on connectivity failures: `TypeError` from `fetch()` (DNS/network down, CORS preflight failure, offline) or a request that errors before getting any HTTP response
- The client **never** falls back on HTTP-level errors — 4xx and 5xx propagate normally so real backend bugs aren't masked
- When a fallback fires, the auth store sets `demoModeActive = true`, which causes the topbar to render a `<DemoBadge/>` pill so the user knows they're not on real data
- A one-time toast fires on the first fallback per session: "Backend unreachable — showing demo data. Some actions won't persist."
- Login itself participates: if `POST /auth/login/json` connectivity-fails AND `DEMO_FALLBACK`, the store fakes login with the mock `currentUser`, sets `demoModeActive = true`, and proceeds to `/`. A real 401 (wrong creds) still surfaces as a form error.

Each `useQuery` hook for a real resource passes a `demoFallback` derived from the existing `mocks/` files. This means the mocks become **a fallback data source, not a parallel data source** — zero duplication.

### 4. API layer organization

```
src/
├── lib/
│   ├── api-client.ts       request() + bearer + refresh + demo-fallback
│   ├── query-client.ts     (already exists) — config unchanged
│   ├── toast.ts            wrapper around sonner — success/error/promise
│   └── form.ts             RHF + zodResolver re-exports + helpers
│
├── features/
│   └── <feature>/
│       ├── api/
│       │   └── <feature>-api.ts    pure functions calling api.*()
│       └── hooks/
│           ├── use-<x>.ts          useQuery wrappers
│           └── use-<mutation>.ts   useMutation wrappers
```

Pattern is identical across features. Once a developer learns it on `patients`, they can read `appointments` cold.

### 5. Query keys

Centralized in `config/constants.ts`. Existing `QUERY_KEYS` extended:

```ts
export const QUERY_KEYS = {
  auth: { me: ['auth', 'me'] as const },
  patients: {
    all: ['patients'] as const,
    list: (filters?: PatientFilters) => ['patients', 'list', filters] as const,
    byId: (id: string) => ['patients', id] as const,
  },
  appointments: {
    all: ['appointments'] as const,
    upcoming: ['appointments', 'upcoming'] as const,
    forPatient: (patientId: string) => ['appointments', 'patient', patientId] as const,
  },
  notes: {
    forPatient: (patientId: string) => ['notes', 'patient', patientId] as const,
  },
  analytics: { snapshot: ['analytics', 'snapshot'] as const },
  ai: {
    summary: (patientId: string) => ['ai', 'summary', patientId] as const,
    risk: (patientId: string) => ['ai', 'risk', patientId] as const,
  },
};
```

Surgical invalidation: updating patient `X` invalidates `patients.byId(X)` and `patients.list` (any filter), leaves everything else alone.

### 6. Mutation patterns

- **Create:** simple — on success → `invalidateQueries(patients.list)`, toast success
- **Update:** optimistic via `onMutate` → patch the cache → `onError` rolls back → `onSettled` refetches
- **Delete:** optimistic remove from list cache, rollback on error

All mutations use `toast.promise()` for inline feedback.

### 7. Forms

- `lib/form.ts` re-exports `useForm`, `zodResolver`, `Controller`, plus a `mapApiError(error, setError)` helper that turns a 422-style FastAPI validation error into RHF field errors
- `components/ui/form.tsx` — new `<FormField>` wrapper component: `label / input / error / hint`. Single source of truth for form field visuals across the app
- Each form lives next to where it's used (`features/auth/components/LoginForm.tsx`, etc.)

### 8. Error UX (4 layers)

| Layer | When | Component |
|---|---|---|
| Inline field error | Form validation | RHF + Zod auto-renders below input |
| Inline banner | Whole-screen failure ("Couldn't load patients") | `<ErrorBanner />` (new) with Retry button |
| Toast | Non-blocking action result | `toast.error/success` from mutation callbacks |
| ErrorBoundary | Render-time crashes | Already in place |

`useErrorMessage(error)` helper translates `ApiError` into user-friendly copy by status.

### 9. Loading states

| Pattern | When | Component |
|---|---|---|
| Skeleton | First load of list/card | `<PatientTableSkeleton/>`, `<CardSkeleton/>` (new) |
| Inline spinner | Refetch of already-shown data | `<Spinner size="sm"/>` (already exists) |
| Disabled + spinner button | Mutation in-flight | Buttons already support `disabled` |
| Page spinner | Auth resolution at app boot | `<PageSpinner/>` (already exists) |

### 10. Topbar updates

- New `<DemoBadge/>` pill on the right cluster, visible only when `demoModeActive === true`
- Avatar dropdown gets a real Logout item that calls `authStore.logout()` → `queryClient.clear()` → `navigate('/login')`
- Notification bell becomes a popover stub (full panel deferred to phase C) showing "no notifications yet"

### 11. Routing

```
/login                  public        <LoginPage />
/                       protected     <Shell /> wraps the existing routes
└── /, /patients, /patients/:id, /insights, /appointments, /docs, /team, /mobile
```

`<ProtectedRoute />` element guards the Shell branch:

- Renders `<PageSpinner/>` while `useCurrentUser()` is `isLoading` and there's no cached user
- If `isAuthenticated === false` after resolution → `<Navigate to="/login" state={{ from: location }} replace />`
- Otherwise → `<Outlet />`

`<PublicRoute />` element guards `/login`:

- If already authenticated → `<Navigate to="/" replace />`
- Otherwise → `<Outlet />`

## File-level delta

**New files:**

```
src/features/auth/
  LoginPage.tsx
  components/LoginForm.tsx
  components/DemoBadge.tsx
  api/auth-api.ts
  hooks/use-login.ts
  hooks/use-logout.ts
  hooks/use-current-user.ts
  index.ts
src/components/auth/
  ProtectedRoute.tsx
  PublicRoute.tsx
src/components/ui/
  form.tsx                       FormField + helpers
  error-banner.tsx               ErrorBanner with retry
  table-skeleton.tsx             PatientTableSkeleton, CardSkeleton
src/lib/
  toast.ts                       toast.success/error/info/promise
  form.ts                        RHF + zod helpers + mapApiError
src/stores/
  auth-store.ts                  Zustand: user, tokens, demoModeActive, login(), logout()
src/features/patients/api/
  patients-api.ts
src/features/patients/hooks/
  use-patients.ts
  use-patient.ts
  use-create-patient.ts
  use-update-patient.ts
  use-delete-patient.ts
src/features/appointments/api/
  appointments-api.ts
src/features/appointments/hooks/
  use-upcoming-appointments.ts
src/features/analytics/api/
  analytics-api.ts
src/features/analytics/hooks/
  use-analytics-snapshot.ts
```

**Modified files:**

```
src/lib/api-client.ts            add demoFallback + 401-refresh-retry
src/app/router.tsx               add /login + ProtectedRoute + PublicRoute
src/app/providers.tsx            mount <Toaster /> from sonner
src/components/layout/Topbar.tsx demo badge, real logout, notifications popover stub
src/config/constants.ts          extend QUERY_KEYS
src/config/env.ts                add DEMO_FALLBACK
src/features/dashboard/DashboardPage.tsx    consume use-current-user
src/features/patients/PatientsPage.tsx      consume use-patients (was static)
src/features/patients/PatientProfilePage.tsx consume use-patient(id)
src/features/dashboard/components/UpcomingAppointments.tsx  consume use-upcoming-appointments
```

**Package additions:**

```
react-hook-form
@hookform/resolvers
zod
```

(`sonner` already installed.)

## Acceptance criteria

1. Visit `/` while unauthenticated → redirected to `/login`
2. `POST` to `/auth/login/json` with seeded creds → land on `/`
3. Topbar shows the real user's name and role
4. `/patients` shows real patients fetched from `/api/v1/patients`, not mocks
5. Clicking a patient navigates to `/patients/:id` and shows their real data
6. Pagination, search, and sort on `/patients` round-trip to the backend
7. Stop the backend (`docker compose stop backend`) → app keeps working with mock data + DemoBadge pill in topbar
8. Logout drops to `/login` and clears the React Query cache
9. A 401 mid-session triggers a silent refresh; if the refresh also 401s, redirect to `/login`
10. Form errors from the backend (e.g., 401 on bad login) appear as inline field errors via `mapApiError`
11. `npm run typecheck` and `npm run lint` both pass clean
12. The implementation is split into commits per concern (auth-store, api-client refresh, login page, patients-api wiring, etc.)

## Risk register

| Risk | Mitigation |
|---|---|
| localStorage tokens are XSS-vulnerable | Documented as a known limitation; phase swap to httpOnly cookies tracked as follow-up |
| Demo fallback silently masks real bugs | Toast a one-time warning on first fallback per session; DemoBadge stays visible |
| Optimistic updates can show inconsistent state on conflict | `onError` rolls back; `onSettled` always refetches |
| Refresh-retry could infinite-loop on backend bug | Hardcap: retry once per failed request, then propagate |
| FastAPI 422 shape changes break `mapApiError` | Helper is defensive: any unrecognized shape falls back to top-level toast |

## Decisions log

- **localStorage over httpOnly cookie**: simpler for demo; user accepted "demo-friendly fallback" posture
- **Mocks become the demo fallback**: rather than duplicate data, the existing `mocks/` files feed the demo-mode path
- **No codegen from OpenAPI**: would break the demo-fallback story and add build complexity for a scaffold project
- **Optimistic updates for update + delete**, simple invalidate for create: snappy UX without rollback complexity for the create path
- **Sonner for toasts**: already a dep
- **Form errors flow back into RHF via `mapApiError`**: backend stays the single source of validation truth

## Next step

After this design is approved and committed, invoke the `writing-plans` skill to produce the implementation plan with explicit, sequenced steps and checkpoint commits.
