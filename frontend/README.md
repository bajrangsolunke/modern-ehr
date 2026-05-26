# Symptra · Frontend

AI-native EHR/EMR frontend.

**Stack:** React 19 · TypeScript · Vite 6 · TailwindCSS · shadcn/ui primitives · Framer Motion · React Query · Zustand · Recharts · Lucide.

## Quick start

```bash
npm install
npm run dev
```

App boots on `http://localhost:5173`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run dev` | Vite dev server with HMR |
| `npm run build` | Type-check + production build |
| `npm run preview` | Preview the production build |
| `npm run typecheck` | TypeScript only |

## Folder structure

```
src/
├── components/
│   ├── ui/             Reusable design-system primitives (Button, Card, …)
│   ├── layout/         Topbar, Shell, PageHeader
│   ├── dashboard/      Dashboard widgets
│   ├── patients/       Patient board + workspace blocks
│   ├── analytics/      Insights widgets
│   ├── charts/         Recharts wrappers
│   └── mobile/         Mobile preview frame + app
├── pages/              Route-level screens
├── data/               Mock healthcare data
├── stores/             Zustand stores
├── lib/                Utilities, helpers, formatters
├── types/              Shared TypeScript types
└── styles/             Tailwind + globals
```

## Screens

1. `/` — AI-Powered Doctor Dashboard
2. `/patients` — Patient Management Board (table + cards)
3. `/patients/:id` — Patient Profile Workspace
4. `/insights` — Smart Analytics & Insights
5. `/appointments` — Appointments
6. `/mobile` — Mobile Companion preview

## Design tokens

Design tokens live in `tailwind.config.ts` and `src/styles/globals.css`. Primary blue `#4F8CFF`, surface `#F5F9FF`, 2xl radii, glass + soft shadow language.

## Notes

- Tailwind utility-first, no inline CSS where possible.
- Animations use Framer Motion with subtle 0.3–0.4s ease-out timings.
- All charts share a consistent grid + tooltip theme.
- App is accessibility-first: focus rings, semantic markup, keyboard nav.
