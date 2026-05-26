# Frontend architecture

Padmavat uses the **feature-first** architecture popularized by *Bulletproof React* and used by Linear, Vercel, Plaid, and most modern React teams. The codebase is organized by **what a thing does for the product**, not by **what kind of file** it is.

## Folder map

```
src/
├── main.tsx                    Entry point — mounts <AppProviders><AppRouter/>
│
├── app/                        Application bootstrap
│   ├── providers.tsx           Query client, Router, ErrorBoundary, Tooltip
│   └── router.tsx              All routes in one place
│
├── components/                 Globally-shared UI building blocks
│   ├── ui/                     shadcn-style primitives (Button, Card, …)
│   ├── layout/                 Shell, Topbar, PageHeader
│   └── feedback/               ErrorBoundary, Spinner
│
├── features/                   The product, grouped by feature
│   ├── dashboard/
│   │   ├── components/         Feature-internal pieces
│   │   ├── DashboardPage.tsx
│   │   └── index.ts            Public API (barrel)
│   ├── patients/
│   ├── appointments/
│   ├── analytics/
│   └── mobile/
│
├── hooks/                      Cross-feature reusable hooks
├── stores/                     Zustand global stores
│
├── lib/                        Third-party glue + cross-cutting helpers
│   ├── api-client.ts           Typed fetch wrapper + ApiError
│   ├── query-client.ts         React Query config
│   └── utils.ts                cn() and small helpers
│
├── config/                     Environment + constants
│   ├── env.ts                  Typed import.meta.env
│   └── constants.ts            ROUTES, QUERY_KEYS, STORAGE_KEYS
│
├── types/                      Globally-shared TS types
├── mocks/                      Demo data (split per domain)
│   ├── users.ts
│   ├── patients.ts
│   ├── appointments.ts
│   ├── clinical.ts
│   ├── analytics.ts
│   └── index.ts                Re-exports all
│
└── styles/
    └── globals.css             Tailwind base + tokens
```

## Rules

1. **A feature is the unit of ownership.** Things that change together live together. Patient table styling, patient data shape, patient row click handler — all under `features/patients/`.

2. **One-way dependencies.**
   - `features/*` may import from `components/`, `lib/`, `config/`, `hooks/`, `stores/`, `types/`, `mocks/`.
   - `features/*` MUST NOT import from another `features/*`. If two features need the same thing, lift it to `components/` or `lib/`.
   - `components/`, `lib/`, `config/` MUST NOT import from `features/`.

3. **Barrels are public APIs.** Each feature exposes only what the router needs via `index.ts`. Internal components are private to the feature.

4. **Path alias is `@/`.** Always `@/features/patients` — never relative `../../../`.

5. **Mocks split by domain.** When the file grows past ~150 lines, split it.

6. **All environment variables go through `config/env.ts`.** Never reach into `import.meta.env` directly outside that file.

## Adding a new feature

```
mkdir src/features/foo
touch src/features/foo/index.ts
touch src/features/foo/FooPage.tsx
```

Then register the route in `src/app/router.tsx`. The route component should be the only thing exported from the barrel.

## Production essentials present

| Concern | Where |
|---|---|
| App composition | `app/providers.tsx` |
| Routing | `app/router.tsx` |
| Error boundary | `components/feedback/ErrorBoundary.tsx` |
| Loading states | `components/feedback/Spinner.tsx` |
| API client | `lib/api-client.ts` |
| Query layer | `lib/query-client.ts` |
| Typed env | `config/env.ts` |
| Route/query/storage keys | `config/constants.ts` |
| Lint | `.eslintrc.cjs` |
| Format | `.prettierrc` + Tailwind class sorting |
| Editor settings | `.editorconfig`, `.nvmrc` |
