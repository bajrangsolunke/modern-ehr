# Symptra · Backend

Production-grade FastAPI backend for the Symptra AI-native EHR platform.

**Stack:** Python 3.12 · FastAPI · SQLAlchemy 2.0 (async) · PostgreSQL · pgvector · Alembic · Redis · Celery · WebSockets · JWT · Pydantic v2 · OpenAI / LangChain.

## Quick start

```bash
# 1. install
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. env
cp .env.example .env
# edit SECRET_KEY, POSTGRES_*, OPENAI_API_KEY

# 3. db
alembic revision --autogenerate -m "init"   # first time only
alembic upgrade head
python -m scripts.seed                       # demo data

# 4. run
uvicorn app.main:app --reload --port 8000
```

API docs: http://localhost:8000/docs

## Project layout

```
app/
├── core/         settings · security · logging
├── db/           SQLAlchemy Base + AsyncSession
├── models/       ORM models (users, patients, soap_notes, labs, …)
├── schemas/      Pydantic v2 request/response models
├── repositories/ data-access layer
├── services/    business logic (auth, patient, appointment, audit, …)
├── ai/          LLM, RAG, summary, risk scoring, scribe
├── api/v1/      routers: auth, patients, appointments, ai, analytics, …
├── middleware/  request-id, security headers
├── workers/     Celery worker + tasks
├── websockets/  WS connection manager
└── main.py      FastAPI factory
```

## Modules

| Module | Endpoint | Purpose |
|---|---|---|
| Auth & RBAC | `/auth/*` | JWT register/login, roles, `/me` |
| Patients | `/patients/*` | CRUD, search, filters |
| Appointments | `/appointments/*` | Scheduling, calendar feeds |
| SOAP Notes | `/notes/*` | Versioned clinical notes |
| Medications | `/medications/*` | Rx tracking |
| Labs | `/labs/*` | Lab results, flags |
| Documents | `/documents/*` | Upload + RAG indexing |
| Notifications | `/notifications/*` | In-app + WebSocket alerts |
| Analytics | `/analytics/snapshot` | KPIs, trends, bottlenecks |
| AI | `/ai/summary`, `/ai/risk/{id}`, `/ai/ask`, `/ai/scribe` | Clinical AI |
| WebSocket | `/ws?token=…` | Real-time stream |

## AI services

- **summary**: LLM-generated clinical summary per patient (JSON output, citations-friendly).
- **risk**: hybrid rule + ML scoring (0-100) with drivers + recommended actions.
- **rag**: pgvector-backed retrieval over patient documents (falls back to recency search when pgvector is unavailable).
- **scribe**: transcript → SOAP note JSON.

The LLM client gracefully falls back to deterministic stub output when `OPENAI_API_KEY` is unset — local dev never breaks.

## Compliance

- Every patient-touching write is recorded in `audit_logs` with `user_id`, IP, user-agent, and payload.
- Security headers (`X-Frame-Options`, `Referrer-Policy`, `X-Content-Type-Options`) on every response.
- Rate limit per IP via `slowapi`.
- Request IDs for end-to-end tracing.

## Tests

```bash
pytest
```

## Celery

```bash
celery -A app.workers.celery_app.celery_app worker -l info
```

## Migrations

```bash
alembic revision --autogenerate -m "your message"
alembic upgrade head
```
