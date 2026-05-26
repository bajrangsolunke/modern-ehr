# Padmavat · AI-native EHR Platform

A next-generation Electronic Health Record / EMR platform with the design language of Linear + Stripe + Apple Health, and an AI-first clinical workflow.

> *Apple + Linear + Stripe built an AI-native EHR.*

![Padmavat](frontend/public/padmavat.svg)

## What's inside

| Layer | Stack | Path |
|---|---|---|
| Frontend | React 19 · TS · Vite · Tailwind · shadcn/ui · Framer Motion · React Query · Zustand · Recharts | [`frontend/`](frontend/) |
| Backend | Python 3.12 · FastAPI · SQLAlchemy 2.0 (async) · PostgreSQL · pgvector · Alembic · Redis · Celery · WebSockets · JWT · OpenAI / LangChain | [`backend/`](backend/) |
| Infra | Docker · docker-compose · Nginx | [`docker-compose.yml`](docker-compose.yml) |

## Screens (frontend)

1. **AI-Powered Doctor Dashboard** — daily summary, AI alerts, Team Gantt, surgery rings, smart scheduling, quick actions
2. **Patient Management Board** — table + card grid, search/filter/sort, multi-select, risk badges
3. **Patient Profile Workspace** — header, clinical overview, AI summary, SOAP notes, vitals, medications, labs, timeline, checklist, documents, clinical action sidebar
4. **Smart Analytics & Insights** — complications, PROMs, delay trends, risk heatmap, bottleneck table, readiness stack
5. **Mobile Companion** — phone-frame preview with AI assistant, medications, vitals, lifestyle, requests
6. **Appointments** — scheduling, AI tips, pending requests

## Backend modules

- **Auth & RBAC** — JWT, role-based (surgeon/physician/nurse/coordinator/admin), `/me`
- **Patients** — CRUD, search, filters, MRN
- **Clinical** — SOAP notes (versioned), medications, labs, vitals, conditions, allergies
- **Appointments** — scheduling with status workflow
- **AI** — `/ai/summary`, `/ai/risk/{id}`, `/ai/ask` (RAG), `/ai/scribe`
- **Documents** — upload + pgvector RAG index
- **Analytics** — KPI snapshot, bottlenecks, trends, heatmap
- **Notifications** — in-app + WebSocket push
- **Audit** — every patient-touching action logged with IP / user agent / payload
- **WebSocket** — `/ws?token=…` real-time channel

## Quick start

### Option A: Docker (recommended)

```bash
cp backend/.env.example backend/.env
docker compose up --build
```

- API → http://localhost:8000/docs
- Frontend → http://localhost:5173

### Option B: Local

**Backend**
```bash
cd backend
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
alembic upgrade head           # or: python -m scripts.seed
uvicorn app.main:app --reload --port 8000
```

**Frontend**
```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

## Design system

Primary `#4F8CFF` · Accent `#7AB2FF` · Background `#F5F9FF` · 2xl radii · soft shadows · Inter typography · glassmorphism · subtle gradients · high whitespace.

Tokens live in [`frontend/tailwind.config.ts`](frontend/tailwind.config.ts) and [`frontend/src/styles/globals.css`](frontend/src/styles/globals.css). All shadcn/ui primitives are wrapped in [`frontend/src/components/ui/`](frontend/src/components/ui/).

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│  React 19 (Vite, TS, Tailwind, shadcn/ui, Framer Motion) │
└──────────────────────┬───────────────────────────────────┘
                       │ REST + WebSocket
┌──────────────────────▼───────────────────────────────────┐
│  FastAPI · Async SQLAlchemy 2.0 · JWT · slowapi · CORS   │
│  Routers ─ Services ─ Repositories ─ Models              │
│  AI: summary · risk · rag · scribe (OpenAI + LangChain)  │
└─────┬──────────────────────────┬─────────────────────────┘
      │                          │
┌─────▼─────────┐         ┌──────▼──────┐
│ PostgreSQL +  │         │ Redis +     │
│ pgvector      │         │ Celery      │
└───────────────┘         └─────────────┘
```

## Compliance posture

- **Audit log** for every patient read/write
- **Security headers** on every response
- **Rate limit** per IP via slowapi
- **JWT** access + refresh, role checks
- **Async-first** for throughput
- **Pydantic v2** request validation
- HIPAA-ready scaffold (storage stub for object store, OCR pipeline scaffold)

## Demo credentials

After running `python -m scripts.seed`:
- `robert.fox@padmavat.health` / `padmavat123` — Surgeon
- `leslie@padmavat.health` / `padmavat123` — Physician
- `jane@padmavat.health` / `padmavat123` — Anesthesiologist

## License

Proprietary — internal demo.
