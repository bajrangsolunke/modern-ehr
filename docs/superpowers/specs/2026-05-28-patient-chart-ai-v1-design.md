# Patient Chart AI — v1

> **Status:** approved through brainstorming. Next: implementation plan.

## Goal

Wire the existing AI inference endpoints (`/ai/summary`, `/ai/risk`,
intake summarizer) into the provider's patient chart so that AI insight
is **visible by default** at the point of care — not buried behind a
button or a separate page. Ship three flows together as one cohesive
sub-project ("Chart AI v1") so the demo tells a complete story:

1. Open patient chart → see AI summary at the top
2. Glance at patient header → see colored risk score chip
3. Approve a patient's intake form → red flags auto-appear as chart alerts on that patient's next chart open

Persistence + a content-hash cache keep token spend bounded: a chart
that hasn't changed serves cached AI output for free.

## Scope

**In:**
- New `AlertSource` enum + `source` column on `patient_alerts`
- New `content_hash` column on existing `ai_insight` table
- Cache layer added to `SummaryService.for_patient()` and `RiskService.score()`
- New aggregator endpoint `GET /api/v1/ai/chart-context/{patient_id}`
- New audit-log actions: `ai.summary`, `ai.risk`, `alert.create.ai`
- Post-commit hook in `FormRequestService.review()` that turns intake red flags into `PatientAlert` rows with `source='ai'`
- New frontend components: `PatientAiSummary` (top of chart), `PatientRiskChip` (in header), `PatientRiskDrawer` (chip click target)
- Sparkles affordance in `AlertsStrip` + `ImportantAlerts` when `alert.source === 'ai'`

**Out (each future sub-project gets its own spec):**
- Patient-facing chat / "ask AI" sidebar (sub-project C)
- SOAP scribe wire-up (sub-project E)
- Medication reconciliation AI cross-check (sub-project F)
- Summarizers for consent / ROI / insurance / discharge / referral forms (intake only in v1)
- Risk-score historical trending chart
- Streaming responses (SSE)
- Manual approval gate before AI alerts are created — they auto-create on intake approval (the human-in-loop is the intake reviewer)
- Critical-severity escalation logic — every AI alert defaults to `warning` in v1

## Architecture

One backend, one provider-frontend. No new services. The cache lives in
the existing `ai_insight` table; the audit trail lives in the existing
`audit_log` table. The intake→chart linkage is a synchronous side-effect
inside the existing `FormRequestService.review()` path — no Celery, no
event bus.

```
backend/app/
├── ai/
│   ├── summary.py            # + content_hash cache; for_patient() returns cached row when fresh
│   ├── risk.py               # + content_hash cache; same pattern
│   └── chart_context.py      # NEW — composes summary + risk + ai_alerts_count
├── api/v1/endpoints/ai.py    # + GET /chart-context/{patient_id}; + ?force=true on summary
├── services/form_request_service.py  # + _propagate_intake_red_flags() called on completed review
├── services/audit_service.py # (uses existing record_request — no signature change)
├── models/alert.py           # + AlertSource enum + source column
└── models/ai_insight.py      # + content_hash column
```

```
frontend/src/features/patients/
├── api/ai-api.ts                       # NEW — typed client for chart-context + force-regenerate
├── hooks/use-chart-ai.ts               # NEW — auto-fires on mount, exposes summary + risk + regenerate
├── components/PatientAiSummary.tsx     # NEW — top-of-chart collapsible card
├── components/PatientRiskChip.tsx      # NEW — color-coded pill in PatientHeader
├── components/PatientRiskDrawer.tsx    # NEW — drivers + actions when chip clicked
├── components/PatientHeader.tsx        # mount <PatientRiskChip />
├── components/AlertsStrip.tsx          # render Sparkles icon for source==='ai'
├── components/ImportantAlerts.tsx      # render Sparkles icon for source==='ai'
└── PatientProfilePage.tsx              # mount <PatientAiSummary /> below PatientHeader
```

### Cache key — `content_hash`

The cache must invalidate when the underlying chart materially changes.
We compute a SHA-256 of a deterministic string built from:

- `patient.id`, `patient.first_name`, `patient.last_name`, `patient.dob`,
  `patient.sex`, `patient.procedure`, `patient.procedure_date`,
  `patient.asa`, `patient.icu_needed`
- sorted list of `(allergy.id, allergy.updated_at.isoformat())` rows
- sorted list of `(condition.id, condition.updated_at.isoformat())` rows
- sorted list of `(medication.id, medication.updated_at.isoformat())` rows
- sorted list of `(lab_result.id, lab_result.updated_at.isoformat())` rows — limited to the 10 most recent (matches what the prompt actually consumes)

Sorting is by id ascending so the same chart always produces the same
string regardless of insertion order. `updated_at` is included so an
in-place edit (e.g., correcting a dose) invalidates the cache without
needing a new row id.

The hash is computed once per request and reused across the summary
and risk cache lookups — both rely on the same underlying chart
snapshot.

### Intake-to-chart linkage

When `FormRequestService.review()` flips an `intake` form to
`completed`, after the existing task-close logic:

1. Call `SummaryService.summarize_intake_form(form_id)` to get the
   `red_flags` list. This service is cheap to call repeatedly because
   it already hits the LLM exactly once per form payload (no separate
   cache yet — the intake form's `data` doesn't change after submission,
   so re-running on approval is bounded by one LLM call per approval).
   If we observe duplicate calls in production, add a form-keyed cache
   later — out of scope for v1.
2. For each red flag, upsert a `PatientAlert`:
   - `patient_id = form.patient_id`
   - `label = red_flag[:128]` (truncate, the model occasionally exceeds the column limit)
   - `severity = AlertSeverity.warning` (no critical escalation in v1)
   - `source = AlertSource.ai`
   - `created_by_id = None` (AI is not a user)
   - dedup: skip if `(patient_id, label, source='ai', resolved=false)` already exists
3. Write an `audit_log` row per created alert with `action='alert.create.ai'`,
   `resource_type='patient_alert'`, `resource_id=alert.id`, `user_id=reviewer.id`.

If the summarizer fails (LLM down, malformed JSON), we log a warning
and let the review succeed — propagation failures must not block the
clinical workflow.

## Data model

### Migration: `patient_alerts.source`

```python
# alembic/versions/{auto-generated-id}_alert_source.py
from alembic import op
import sqlalchemy as sa

def upgrade():
    op.execute("CREATE TYPE alert_source AS ENUM ('manual', 'ai', 'system')")
    op.add_column(
        "patient_alerts",
        sa.Column(
            "source",
            sa.Enum("manual", "ai", "system", name="alert_source"),
            nullable=False,
            server_default="manual",
        ),
    )
    op.create_index("ix_patient_alerts_source", "patient_alerts", ["source"])

def downgrade():
    op.drop_index("ix_patient_alerts_source", table_name="patient_alerts")
    op.drop_column("patient_alerts", "source")
    op.execute("DROP TYPE alert_source")
```

### Migration: `ai_insight.content_hash`

```python
def upgrade():
    op.add_column(
        "ai_insights",
        sa.Column("content_hash", sa.String(64), nullable=True),
    )
    op.create_index(
        "ix_ai_insights_lookup",
        "ai_insights",
        ["patient_id", "category", "content_hash"],
    )

def downgrade():
    op.drop_index("ix_ai_insights_lookup", table_name="ai_insights")
    op.drop_column("ai_insights", "content_hash")
```

The composite index `(patient_id, category, content_hash)` is the cache
lookup hot path.

### `ai_insight.category` values used in v1

| category | What it stores |
|---|---|
| `chart_summary` | Output of `SummaryService.for_patient` (summary, bullets, confidence) |
| `risk_score` | Output of `RiskService.score` (risk_score, risk_level, drivers, actions) |
| `intake_summary` | Output of `SummaryService.summarize_intake_form` (already populated for the forms feature; reused here as the source of red flags) |

The `summary` column holds the human-readable string, `actions` JSONB
holds the structured fields (`bullets`, `drivers`, etc.) so the
existing `AiInsightOut` schema covers both.

## API contract

### Modified: `POST /api/v1/ai/summary`

Behavior change only — no breaking schema change. Adds:

- Query param `?force=true` bypasses cache (always recomputes + persists fresh row).
- Service computes `content_hash`, looks up cached row. Hit → returns persisted row, sets `cached=true`. Miss → computes, persists, returns `cached=false`.
- Every call (cached or fresh) writes an `audit_log` row with `action='ai.summary'`, `resource_type='patient'`, `resource_id=patient_id`, `payload={'model': ..., 'cached': ...}`.

Response gains one field:

```json
{
  "patient_id": "...",
  "summary": "...",
  "bullets": [...],
  "confidence": 0.8,
  "model": "llama-3.3-70b-versatile",
  "generated_at": "2026-05-28T10:15:00Z",
  "cached": true
}
```

### Modified: `GET /api/v1/ai/risk/{patient_id}`

Same cache + audit pattern, `category='risk_score'`. `?force=true` supported. Response gains `"cached": bool`.

### New: `GET /api/v1/ai/chart-context/{patient_id}`

One-shot aggregator the frontend calls on chart mount. Returns:

```json
{
  "summary": { /* AiSummaryResponse + cached:bool */ },
  "risk": { /* AiRiskScoreResponse + cached:bool */ },
  "ai_alerts_count": 3
}
```

Implementation: computes `content_hash` once, runs the two cache
lookups in `asyncio.gather`. If both hit → ~50ms total. If both miss
→ ~1–2s (two parallel LLM calls). `ai_alerts_count` is a cheap COUNT
on `patient_alerts WHERE patient_id=:id AND source='ai' AND resolved=false`.

Auth: `CurrentUser` (provider/admin). Audit: writes one
`ai.summary` + one `ai.risk` row (same as the individual endpoints).

### Modified: `POST /api/v1/form-requests/{form_id}/review`

No request/response schema change. Behavior change: on `decision=completed`
*and* `form.form_type == intake`, the post-success path runs the
intake-to-chart linkage described in the Architecture section.

Linkage failures (LLM error, transient DB error on alert insert) are
caught, logged at `warn` level, and **do not roll back the review**.
The review remains the source of truth for the form workflow; AI is
best-effort enrichment on top.

## Frontend components

### `PatientAiSummary` (top of `PatientProfilePage`)

Reuses the visual pattern from `IntakeAiSummary` (Sparkles header,
model badge, confidence %, collapse chevron, regenerate). Sits
**below** `PatientHeader` and **above** `AlertsStrip`. Auto-fetches
via `use-chart-ai`. Skeleton state while loading. Hidden completely
if the call fails — never blocks the rest of the chart.

### `PatientRiskChip` (inside `PatientHeader`)

Compact pill: `Risk 72 · High` (severity word from `risk_level`).
Color rules (matches existing `STATUS_TONE` palette):
- `low` (score 0–39) → `bg-success/10 text-success`
- `moderate` (40–69) → `bg-warning/10 text-warning`
- `high` (70–100) → `bg-danger/10 text-danger`

Clicking opens `PatientRiskDrawer` populated from the same React Query
cache key — no extra fetch.

### `PatientRiskDrawer`

Slides in from the right with:
- Big number + risk_level badge
- Drivers (bullet list)
- Recommended actions (bullet list)
- "Regenerate" button → calls `/ai/risk/{id}?force=true`, invalidates the chart-context query, closes drawer

### `AlertsStrip` + `ImportantAlerts` modifications

A `<Sparkles className="size-3" />` icon (with `title="AI-generated alert"` tooltip) is shown next to the alert label when `alert.source === 'ai'`. Existing manual alerts unchanged. The dismiss / resolve UX is identical regardless of source.

### `use-chart-ai` hook (the orchestrator)

```ts
export function useChartAi(patientId: string) {
  const { data, isLoading, refetch } = useQuery({
    queryKey: ["patient", patientId, "chart-ai"],
    queryFn: () => patientsAiApi.getChartContext(patientId),
    enabled: Boolean(patientId),
    staleTime: 0,          // server cache is authoritative; client never hides a re-fetch
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
  return { summary: data?.summary, risk: data?.risk, aiAlertsCount: data?.aiAlertsCount ?? 0, isLoading, regenerate: refetch };
}
```

The client `staleTime: 0` is intentional — the *server* owns freshness
via `content_hash`. The hook just needs to call once per chart open
and trust the response.

## Sequence diagrams

### Chart open — cache hit (warm chart)
```
User clicks /patients/:id
  PatientProfilePage mounts
    useChartAi(id) → GET /ai/chart-context/:id
      backend:
        hash = compute_content_hash(patient_chart_snapshot)
        SELECT ai_insight WHERE patient_id=:id AND category IN ('chart_summary','risk_score') AND content_hash=:hash
        rows = [chart_summary, risk_score]   ← 2 hits
        SELECT COUNT(*) FROM patient_alerts WHERE patient_id=:id AND source='ai' AND resolved=false
        audit_log × 2 (ai.summary, ai.risk, cached=true)
      response in ~50–100ms
    render summary + risk chip simultaneously
```

### Chart open — cache miss (cold chart, or chart changed)
```
User clicks /patients/:id
  PatientProfilePage mounts
    useChartAi(id) → GET /ai/chart-context/:id
      backend:
        hash = compute_content_hash(...)
        cache lookup → 0 hits
        asyncio.gather(
          summary_service.compute_and_persist(),
          risk_service.compute_and_persist(),
        )
          each: llm_client.chat(...) → insert ai_insight row with content_hash
        audit_log × 2 (ai.summary, ai.risk, cached=false)
      response in ~1–2s
    render
```

### Intake approval → chart alerts
```
Staff opens submitted intake form → clicks "Mark Completed"
  POST /form-requests/:id/review {decision: "completed"}
    FormRequestService.review() runs existing logic
    next_status == completed AND form.form_type == intake:
      try:
        summary = SummaryService.summarize_intake_form(form_id)
        for red_flag in summary.red_flags:
          existing = SELECT * FROM patient_alerts WHERE patient_id=? AND label=? AND source='ai' AND resolved=false
          if not existing:
            INSERT patient_alerts (..., source='ai', severity='warning', created_by_id=NULL)
            audit_log(action='alert.create.ai', ...)
      except Exception as e:
        log.warning("intake_propagation_failed", form_id=..., error=str(e))
        # review still succeeds
  response: FormRequestOut
  next time provider opens chart → AlertsStrip shows new ✨ alerts
```

## Risks & open questions

- **R1: Cache invalidation correctness.** If we forget a chart-data column when computing `content_hash`, the cache will serve stale output silently. Mitigation: write a unit test that asserts the hash *does* change for each mutated column in the snapshot.
- **R2: Intake propagation latency.** Calling the LLM inside the review request adds 1–2s to the staff's "Mark Completed" click. Acceptable for v1 (one-time cost on approval). If users complain, move to a Celery task (out of scope here).
- **R3: AI alert spam.** A noisy intake (e.g., patient lists 10 medications) could explode into 10 alerts. Mitigation: hard cap of 5 AI alerts per intake approval — anything beyond is dropped with a warning log. Provider can still see the full list in the intake summary panel.
- **R4: PHI in audit_log payload.** Existing `audit_log.payload` is JSONB. We log `{model, cached}` only — no chart content, no LLM output. Lock that down in code review.
- **R5: Forced regenerate ignores cost.** No rate limit on `?force=true`. Acceptable on Groq free tier; revisit when on paid Bedrock/OpenAI.

## Acceptance criteria — full list

(Same as presented in brainstorming, re-stated here as the source of
truth for plan + tests.)

**US-CHART-AI-1: Provider sees AI summary on chart open**
- AC1: Summary card auto-loads at the top of `PatientProfilePage`, above `AlertsStrip`
- AC2: Shows skeleton for ≤2s while computing; then renders summary + bullets
- AC3: Collapsible chevron toggle; state held in component (resets on page reload — no persistence in v1)
- AC4: Shows model name + "AI-generated, verify" disclaimer
- AC5: "Regenerate" button calls `?force=true` and refetches

**US-CHART-AI-2: Provider sees AI risk chip in patient header**
- AC1: Chip rendered in `PatientHeader`, format: `Risk 72 · High`
- AC2: Color-coded by `risk_level` (low/moderate/high)
- AC3: Clicking opens `PatientRiskDrawer` with drivers + actions
- AC4: Drawer pulled from existing `/ai/risk/{patient_id}` (no extra fetch — uses cache)

**US-CHART-AI-3: Intake red flags auto-create chart alerts**
- AC1: On `FormRequestStatus.completed` for an intake form, backend runs the summarizer
- AC2: Each red flag becomes a `PatientAlert` row with `source='ai'`, `severity='warning'`
- AC3: AI-sourced alerts visually marked with a Sparkles icon in `AlertsStrip` and `ImportantAlerts`
- AC4: Providers can resolve AI alerts the same way as manual ones (`resolved=true`)
- AC5: Duplicate prevention — if the same `(patient_id, label, source='ai', resolved=false)` exists, skip
- AC6: Hard cap of 5 AI alerts per intake approval (see R3)
- AC7: Propagation failure must not block the review request (see R2)

**US-CHART-AI-4: Summaries are cached and only recompute on chart change**
- AC1: Backend stores summary in `ai_insight` with `content_hash` of the chart snapshot
- AC2: Hit on `(patient_id, category, content_hash)` returns the persisted row with `cached=true`
- AC3: Miss computes, persists, returns `cached=false`
- AC4: `?force=true` bypasses the cache lookup entirely and writes a fresh row
- AC5: Hash includes the columns listed in the Architecture section

**US-CHART-AI-5: AI calls are audit-logged**
- AC1: Every `/ai/summary` and `/ai/risk` call writes an `audit_log` row with action=`ai.summary` / `ai.risk`, including cached:bool and model name in payload
- AC2: AI-sourced alert creation logged with action=`alert.create.ai`
- AC3: No LLM input or output content is written to audit_log (only the model identifier and cached flag)

## Testing strategy

- **Unit:** `compute_content_hash()` is deterministic for stable input; changes when any tracked field changes (one test per mutated field).
- **Unit:** `_propagate_intake_red_flags()` skips duplicates; caps at 5; swallows LLM exceptions.
- **Integration:** `POST /ai/summary` on a fresh patient writes one row; second call returns `cached=true`; `?force=true` writes a second row.
- **Integration:** `POST /form-requests/:id/review` with a completed intake creates the expected number of `source='ai'` alerts.
- **Integration:** `GET /ai/chart-context/:id` returns both blocks; correct `ai_alerts_count`.
- **Frontend (manual):** chart load with stub LLM provider renders a fallback summary; with Groq renders real output; chip color matches risk level; sparkles icon shows on AI alerts.
