# Patient Chart AI v1 — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire existing `/ai/summary` and `/ai/risk` endpoints into the provider patient chart with a DB-cache layer, surface AI summary + risk-score chip on the chart, and auto-propagate intake-form red flags into `patient_alerts` with `source='ai'`.

**Architecture:** Sync-on-open with content-hash cache. Two alembic migrations add `patient_alerts.source` enum and `ai_insights.content_hash`. Existing AI services gain a cache check before LLM call. New aggregator endpoint `GET /ai/chart-context/:id`. Intake-to-chart linkage is a synchronous best-effort side-effect inside `FormRequestService.review()`. Frontend gets new components for summary card, risk chip + drawer, and Sparkles affordance on AI alerts.

**Tech Stack:** FastAPI · SQLAlchemy 2.x (async) · Alembic · Pydantic v2 · pytest-asyncio · React 18 · TanStack Query v5 · TypeScript · Tailwind · lucide-react.

**Source spec:** `docs/superpowers/specs/2026-05-28-patient-chart-ai-v1-design.md`

---

## File Structure

**Backend create:**
- `backend/alembic/versions/0016_alert_source.py`
- `backend/alembic/versions/0017_ai_insight_cache.py`
- `backend/app/ai/chart_hash.py`
- `backend/app/ai/chart_context.py`
- `backend/tests/ai/test_chart_hash.py`
- `backend/tests/ai/test_summary_cache.py`
- `backend/tests/ai/test_chart_context.py`
- `backend/tests/forms/test_intake_propagation.py`

**Backend modify:**
- `backend/app/models/alert.py` (add `AlertSource` enum + `source` column)
- `backend/app/models/ai_insight.py` (add `content_hash` column)
- `backend/app/schemas/alert.py` (add `source` to `AlertOut`)
- `backend/app/schemas/ai.py` (add `cached: bool` to summary + risk response)
- `backend/app/ai/summary.py` (`for_patient` reads/writes cache)
- `backend/app/ai/risk.py` (`score` reads/writes cache)
- `backend/app/api/v1/endpoints/ai.py` (audit log, `?force` param, `/chart-context/:id`)
- `backend/app/services/form_request_service.py` (propagation hook)

**Frontend create:**
- `frontend/src/features/patients/api/ai-api.ts`
- `frontend/src/features/patients/hooks/use-chart-ai.ts`
- `frontend/src/features/patients/components/PatientAiSummary.tsx`
- `frontend/src/features/patients/components/PatientRiskChip.tsx`
- `frontend/src/features/patients/components/PatientRiskDrawer.tsx`

**Frontend modify:**
- `frontend/src/features/patients/api/alerts-api.ts` (map `source` field)
- `frontend/src/features/patients/components/PatientHeader.tsx` (mount risk chip)
- `frontend/src/features/patients/components/AlertsStrip.tsx` (Sparkles on AI source)
- `frontend/src/features/patients/components/ImportantAlerts.tsx` (Sparkles on AI source)
- `frontend/src/features/patients/PatientProfilePage.tsx` (mount AI summary)

---

## Phase 1 — Backend data layer

### Task 1: Migration — add `AlertSource` enum + `source` column to `patient_alerts`

**Files:**
- Create: `backend/alembic/versions/0016_alert_source.py`

- [ ] **Step 1: Create the migration file**

```python
"""add alert source enum + column

Revision ID: 0016_alert_source
Revises: 0015_task_type
Create Date: 2026-05-28

Adds the `source` column to `patient_alerts` so we can distinguish
clinician-entered alerts from AI-generated ones (intake red flags,
future lab anomalies, etc.) and from deterministic-rule alerts.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0016_alert_source"
down_revision: Union[str, None] = "0015_task_type"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


ALERT_SOURCE = sa.Enum("manual", "ai", "system", name="alert_source")


def upgrade() -> None:
    ALERT_SOURCE.create(op.get_bind(), checkfirst=True)
    op.add_column(
        "patient_alerts",
        sa.Column(
            "source",
            ALERT_SOURCE,
            nullable=False,
            server_default="manual",
        ),
    )
    op.create_index(
        "ix_patient_alerts_source", "patient_alerts", ["source"]
    )


def downgrade() -> None:
    op.drop_index("ix_patient_alerts_source", table_name="patient_alerts")
    op.drop_column("patient_alerts", "source")
    ALERT_SOURCE.drop(op.get_bind(), checkfirst=True)
```

- [ ] **Step 2: Run the migration to verify it applies**

```bash
cd backend && source .venv/bin/activate && alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade 0015_task_type -> 0016_alert_source`

- [ ] **Step 3: Verify the column exists**

```bash
psql padmavat -c "\d patient_alerts" | grep source
```

Expected: `source | alert_source | not null default 'manual'::alert_source`

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/0016_alert_source.py
git commit -m "feat(db): add source column to patient_alerts for AI/manual/system distinction"
```

---

### Task 2: Migration — add `content_hash` column to `ai_insights`

**Files:**
- Create: `backend/alembic/versions/0017_ai_insight_cache.py`

- [ ] **Step 1: Create the migration file**

```python
"""add content_hash to ai_insights for cache lookup

Revision ID: 0017_ai_insight_cache
Revises: 0016_alert_source
Create Date: 2026-05-28

Adds a `content_hash` column to ai_insights so summary/risk services
can cache LLM outputs and skip re-computation when the chart hasn't
changed. The composite index (patient_id, category, content_hash) is
the cache lookup hot path.
"""
from __future__ import annotations

from collections.abc import Sequence
from typing import Union

import sqlalchemy as sa
from alembic import op

revision: str = "0017_ai_insight_cache"
down_revision: Union[str, None] = "0016_alert_source"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        "ai_insights",
        sa.Column("content_hash", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_ai_insights_lookup",
        "ai_insights",
        ["patient_id", "category", "content_hash"],
    )


def downgrade() -> None:
    op.drop_index("ix_ai_insights_lookup", table_name="ai_insights")
    op.drop_column("ai_insights", "content_hash")
```

- [ ] **Step 2: Run the migration**

```bash
cd backend && alembic upgrade head
```

Expected: `INFO  [alembic.runtime.migration] Running upgrade 0016_alert_source -> 0017_ai_insight_cache`

- [ ] **Step 3: Verify**

```bash
psql padmavat -c "\d ai_insights" | grep content_hash
```

Expected: `content_hash | character varying(64)`

- [ ] **Step 4: Commit**

```bash
git add backend/alembic/versions/0017_ai_insight_cache.py
git commit -m "feat(db): add content_hash to ai_insights for cache lookup"
```

---

### Task 3: Update `PatientAlert` model with `AlertSource`

**Files:**
- Modify: `backend/app/models/alert.py`

- [ ] **Step 1: Replace the file content with the new model**

```python
from __future__ import annotations

import enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.user import User


class AlertSeverity(str, enum.Enum):
    critical = "critical"
    warning = "warning"
    info = "info"


class AlertSource(str, enum.Enum):
    """Where the alert came from. `manual` is the default (clinician-entered);
    `ai` flags rows produced by AI inference (intake red flags, etc.);
    `system` is reserved for deterministic rule output (future use)."""

    manual = "manual"
    ai = "ai"
    system = "system"


class PatientAlert(Base, UUIDMixin, TimestampMixin):
    """
    Patient-scoped clinical alert (e.g. blood thinner, DNR, falls risk).
    Surfaced as chips on the patient header so clinicians see them on
    every tab without hunting.
    """

    __tablename__ = "patient_alerts"

    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    severity: Mapped[AlertSeverity] = mapped_column(
        Enum(AlertSeverity, name="alert_severity"),
        default=AlertSeverity.info,
        nullable=False,
    )
    source: Mapped[AlertSource] = mapped_column(
        Enum(AlertSource, name="alert_source"),
        default=AlertSource.manual,
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)

    # Soft-resolve flag — keep the row for audit but hide from the strip.
    resolved: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )

    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    patient: Mapped[Patient] = relationship()
    created_by: Mapped[User | None] = relationship()
```

- [ ] **Step 2: Verify it imports without error**

```bash
cd backend && python -c "from app.models.alert import PatientAlert, AlertSource; print(list(AlertSource))"
```

Expected: `[<AlertSource.manual: 'manual'>, <AlertSource.ai: 'ai'>, <AlertSource.system: 'system'>]`

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/alert.py
git commit -m "feat(models): add AlertSource to PatientAlert"
```

---

### Task 4: Update `AiInsight` model with `content_hash`

**Files:**
- Modify: `backend/app/models/ai_insight.py`

- [ ] **Step 1: Replace the file content**

```python
from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import DateTime, Float, ForeignKey, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, UUIDMixin


class AiInsight(Base, UUIDMixin):
    __tablename__ = "ai_insights"

    patient_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    category: Mapped[str] = mapped_column(String(32), index=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.0)
    model: Mapped[str] = mapped_column(String(64), default="gpt-4o-mini")
    actions: Mapped[dict | None] = mapped_column(JSONB)
    # SHA-256 hex of the chart snapshot at the time of generation —
    # used by the cache layer to detect when the underlying data has
    # changed and a regen is needed. Indexed via composite index in
    # migration 0017.
    content_hash: Mapped[str | None] = mapped_column(String(64), index=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
```

- [ ] **Step 2: Verify imports**

```bash
cd backend && python -c "from app.models.ai_insight import AiInsight; print(AiInsight.__table__.columns.keys())"
```

Expected output contains `'content_hash'`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/models/ai_insight.py
git commit -m "feat(models): add content_hash to AiInsight for cache key"
```

---

### Task 5: Update `AlertOut` schema to surface `source`

**Files:**
- Modify: `backend/app/schemas/alert.py`

- [ ] **Step 1: Apply the edit — add the `source` field**

Replace the file with:

```python
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.alert import AlertSeverity, AlertSource


class AlertBase(BaseModel):
    severity: AlertSeverity = AlertSeverity.info
    label: str = Field(..., min_length=1, max_length=128)
    detail: str | None = Field(default=None, max_length=4000)


class AlertCreate(AlertBase):
    patient_id: UUID


class AlertUpdate(BaseModel):
    severity: AlertSeverity | None = None
    label: str | None = Field(default=None, min_length=1, max_length=128)
    detail: str | None = Field(default=None, max_length=4000)
    resolved: bool | None = None


class AlertOut(AlertBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    patient_id: UUID
    source: AlertSource = AlertSource.manual
    resolved: bool
    created_by_id: UUID | None
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 2: Verify**

```bash
cd backend && python -c "from app.schemas.alert import AlertOut; print('source' in AlertOut.model_fields)"
```

Expected: `True`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/alert.py
git commit -m "feat(schemas): expose alert source on AlertOut"
```

---

## Phase 2 — Backend cache layer

### Task 6: Implement `chart_hash` helper with TDD

**Files:**
- Create: `backend/app/ai/chart_hash.py`
- Test: `backend/tests/ai/test_chart_hash.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/ai/test_chart_hash.py`:

```python
"""Unit tests for compute_chart_hash — the cache key for AI insights.

The hash must be:
1. Stable across runs for identical input (deterministic)
2. Stable across insertion order (sorted internally)
3. Sensitive to every field we care about (mutating any tracked field
   must change the hash, or the cache will serve stale data silently)
"""
from __future__ import annotations

from datetime import date, datetime, timezone
from uuid import uuid4

import pytest

from app.ai.chart_hash import compute_chart_hash


def _patient(**overrides):
    """Minimal patient-like object — uses a SimpleNamespace so we don't
    need a real SQLAlchemy session to test the hash function."""
    from types import SimpleNamespace

    base = dict(
        id=uuid4(),
        first_name="Jane",
        last_name="Doe",
        dob=date(1960, 1, 1),
        sex="F",
        procedure="hip replacement",
        procedure_date=date(2026, 6, 1),
        asa="II",
        icu_needed=False,
    )
    base.update(overrides)
    return SimpleNamespace(**base)


def _row(id_=None, updated_at=None, **rest):
    from types import SimpleNamespace

    return SimpleNamespace(
        id=id_ or uuid4(),
        updated_at=updated_at or datetime(2026, 5, 1, tzinfo=timezone.utc),
        **rest,
    )


def test_hash_is_deterministic():
    p = _patient()
    h1 = compute_chart_hash(patient=p, allergies=[], conditions=[], medications=[], labs=[])
    h2 = compute_chart_hash(patient=p, allergies=[], conditions=[], medications=[], labs=[])
    assert h1 == h2
    assert len(h1) == 64  # SHA-256 hex


def test_hash_ignores_input_ordering():
    p = _patient()
    a1, a2 = _row(), _row()
    h_a = compute_chart_hash(
        patient=p, allergies=[a1, a2], conditions=[], medications=[], labs=[]
    )
    h_b = compute_chart_hash(
        patient=p, allergies=[a2, a1], conditions=[], medications=[], labs=[]
    )
    assert h_a == h_b


def test_hash_changes_when_patient_field_changes():
    base = _patient()
    h_base = compute_chart_hash(patient=base, allergies=[], conditions=[], medications=[], labs=[])

    for field, mutated in [
        ("first_name", "Jenna"),
        ("dob", date(1961, 1, 1)),
        ("asa", "IV"),
        ("icu_needed", True),
        ("procedure", "knee replacement"),
        ("procedure_date", date(2026, 7, 1)),
    ]:
        p = _patient(**{field: mutated})
        h = compute_chart_hash(patient=p, allergies=[], conditions=[], medications=[], labs=[])
        assert h != h_base, f"hash did not change when {field} changed"


def test_hash_changes_when_allergy_updated_at_changes():
    p = _patient()
    a = _row()
    h1 = compute_chart_hash(patient=p, allergies=[a], conditions=[], medications=[], labs=[])
    a.updated_at = datetime(2026, 5, 2, tzinfo=timezone.utc)
    h2 = compute_chart_hash(patient=p, allergies=[a], conditions=[], medications=[], labs=[])
    assert h1 != h2


def test_hash_changes_when_medication_added():
    p = _patient()
    h_empty = compute_chart_hash(patient=p, allergies=[], conditions=[], medications=[], labs=[])
    h_one = compute_chart_hash(patient=p, allergies=[], conditions=[], medications=[_row()], labs=[])
    assert h_empty != h_one
```

- [ ] **Step 2: Run the test to see it fail**

```bash
cd backend && pytest tests/ai/test_chart_hash.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.ai.chart_hash'`

- [ ] **Step 3: Implement `chart_hash.py`**

Create `backend/app/ai/chart_hash.py`:

```python
"""Deterministic hash over the patient chart snapshot.

The output is the cache key for AI insight rows. Two requirements:

  1. Same input → same output (so cache hits are reliable)
  2. Sensitive to every field that influences AI output (so the cache
     is never stale)

If a column influences the prompt but is missing here, the cache will
silently serve stale data. See `test_chart_hash.py` for the contract.
"""
from __future__ import annotations

import hashlib
from collections.abc import Iterable
from typing import Any


def _row_key(row: Any) -> str:
    """Stable string for a chart row. Uses `id` for identity and
    `updated_at` so in-place edits invalidate the cache."""
    rid = getattr(row, "id", "")
    updated = getattr(row, "updated_at", "")
    if hasattr(updated, "isoformat"):
        updated = updated.isoformat()
    return f"{rid}|{updated}"


def _rows_block(rows: Iterable[Any]) -> str:
    items = sorted(_row_key(r) for r in rows)
    return ",".join(items)


def compute_chart_hash(
    *,
    patient: Any,
    allergies: Iterable[Any],
    conditions: Iterable[Any],
    medications: Iterable[Any],
    labs: Iterable[Any],
) -> str:
    """Return a 64-char hex SHA-256 over a deterministic projection of
    the chart. Caller owns row selection (e.g., limit to 10 recent labs)."""
    parts: list[str] = []

    p_fields = (
        "id",
        "first_name",
        "last_name",
        "dob",
        "sex",
        "procedure",
        "procedure_date",
        "asa",
        "icu_needed",
    )
    for f in p_fields:
        v = getattr(patient, f, None)
        if hasattr(v, "isoformat"):
            v = v.isoformat()
        parts.append(f"{f}={v}")

    parts.append("allergies=" + _rows_block(allergies))
    parts.append("conditions=" + _rows_block(conditions))
    parts.append("medications=" + _rows_block(medications))
    parts.append("labs=" + _rows_block(labs))

    blob = "\n".join(parts).encode("utf-8")
    return hashlib.sha256(blob).hexdigest()
```

- [ ] **Step 4: Run the test — expect green**

```bash
cd backend && pytest tests/ai/test_chart_hash.py -v
```

Expected: 5 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/ai/chart_hash.py backend/tests/ai/test_chart_hash.py
git commit -m "feat(ai): add deterministic chart-hash helper for cache key"
```

---

### Task 7: Add `cached` field to AI response schemas

**Files:**
- Modify: `backend/app/schemas/ai.py`

- [ ] **Step 1: Edit `AiSummaryResponse` and `AiRiskScoreResponse`**

Find this block in `backend/app/schemas/ai.py`:

```python
class AiSummaryResponse(BaseModel):
    patient_id: UUID
    summary: str
    bullets: list[str]
    confidence: float
    model: str
    generated_at: datetime
```

Replace with:

```python
class AiSummaryResponse(BaseModel):
    patient_id: UUID
    summary: str
    bullets: list[str]
    confidence: float
    model: str
    generated_at: datetime
    cached: bool = False
```

Find this block:

```python
class AiRiskScoreResponse(BaseModel):
    patient_id: UUID
    risk_score: int
    risk_level: str
    drivers: list[str]
    recommended_actions: list[str]
    model: str
    generated_at: datetime
```

Replace with:

```python
class AiRiskScoreResponse(BaseModel):
    patient_id: UUID
    risk_score: int
    risk_level: str
    drivers: list[str]
    recommended_actions: list[str]
    model: str
    generated_at: datetime
    cached: bool = False
```

- [ ] **Step 2: Verify**

```bash
cd backend && python -c "from app.schemas.ai import AiSummaryResponse, AiRiskScoreResponse; assert 'cached' in AiSummaryResponse.model_fields and 'cached' in AiRiskScoreResponse.model_fields; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/ai.py
git commit -m "feat(schemas): add cached:bool to AI summary + risk responses"
```

---

### Task 8: Wire cache layer into `SummaryService.for_patient` (TDD)

**Files:**
- Test: `backend/tests/ai/test_summary_cache.py`
- Modify: `backend/app/ai/summary.py`

- [ ] **Step 1: Write the failing integration test**

Create `backend/tests/ai/test_summary_cache.py`:

```python
"""Integration test: SummaryService.for_patient must use the ai_insight
cache. First call writes a row; second call (same chart) reads it back
with cached=True; force=True bypasses and writes a new row.

Relies on the project's standard async test fixtures (db_session,
sample_patient). If your fixtures are named differently, adjust the
parameters here, not the assertions."""
from __future__ import annotations

import pytest
from sqlalchemy import func, select

from app.ai.summary import SummaryService
from app.models.ai_insight import AiInsight


@pytest.mark.asyncio
async def test_first_call_writes_insight_row_and_marks_uncached(
    db_session, sample_patient
):
    service = SummaryService(db_session)
    res = await service.for_patient(sample_patient.id)
    assert res.cached is False

    count = await db_session.scalar(
        select(func.count(AiInsight.id)).where(
            AiInsight.patient_id == sample_patient.id,
            AiInsight.category == "chart_summary",
        )
    )
    assert count == 1


@pytest.mark.asyncio
async def test_second_call_returns_cached_without_new_row(
    db_session, sample_patient
):
    service = SummaryService(db_session)
    await service.for_patient(sample_patient.id)
    res2 = await service.for_patient(sample_patient.id)
    assert res2.cached is True

    count = await db_session.scalar(
        select(func.count(AiInsight.id)).where(
            AiInsight.patient_id == sample_patient.id,
            AiInsight.category == "chart_summary",
        )
    )
    assert count == 1  # still only the one row


@pytest.mark.asyncio
async def test_force_true_bypasses_cache_and_writes_new_row(
    db_session, sample_patient
):
    service = SummaryService(db_session)
    await service.for_patient(sample_patient.id)
    res = await service.for_patient(sample_patient.id, force=True)
    assert res.cached is False

    count = await db_session.scalar(
        select(func.count(AiInsight.id)).where(
            AiInsight.patient_id == sample_patient.id,
            AiInsight.category == "chart_summary",
        )
    )
    assert count == 2
```

- [ ] **Step 2: Run — expect failure (SummaryService doesn't accept `force` and doesn't cache yet)**

```bash
cd backend && pytest tests/ai/test_summary_cache.py -v
```

Expected: failures on `force` kwarg and on `res.cached` not being True on second call.

- [ ] **Step 3: Modify `SummaryService.for_patient` to use the cache**

In `backend/app/ai/summary.py`, replace the existing `for_patient` method body with the cache-aware version. Locate this method:

```python
    async def for_patient(self, patient_id: UUID, style: str = "clinical") -> AiSummaryResponse:
```

Replace the entire method through the closing `return AiSummaryResponse(...)` with:

```python
    async def for_patient(
        self,
        patient_id: UUID,
        style: str = "clinical",
        *,
        force: bool = False,
    ) -> AiSummaryResponse:
        patient = await self.db.get(Patient, patient_id)
        if not patient:
            raise ValueError("Patient not found")

        allergies = (
            await self.db.execute(select(Allergy).where(Allergy.patient_id == patient_id))
        ).scalars().all()
        conditions = (
            await self.db.execute(select(Condition).where(Condition.patient_id == patient_id))
        ).scalars().all()
        meds = (
            await self.db.execute(select(Medication).where(Medication.patient_id == patient_id))
        ).scalars().all()
        labs = (
            await self.db.execute(
                select(LabResult)
                .where(LabResult.patient_id == patient_id)
                .order_by(LabResult.created_at.desc())
                .limit(10)
            )
        ).scalars().all()

        chart_hash = compute_chart_hash(
            patient=patient,
            allergies=allergies,
            conditions=conditions,
            medications=meds,
            labs=labs,
        )

        if not force:
            cached_row = (
                await self.db.execute(
                    select(AiInsight)
                    .where(
                        AiInsight.patient_id == patient_id,
                        AiInsight.category == "chart_summary",
                        AiInsight.content_hash == chart_hash,
                    )
                    .order_by(AiInsight.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if cached_row is not None:
                actions = cached_row.actions or {}
                return AiSummaryResponse(
                    patient_id=patient_id,
                    summary=cached_row.summary,
                    bullets=list(actions.get("bullets") or []),
                    confidence=float(cached_row.confidence or 0.0),
                    model=cached_row.model,
                    generated_at=cached_row.created_at,
                    cached=True,
                )

        ctx = self._format_context(patient, allergies, conditions, meds, labs, style)
        raw = await llm_client.chat(
            messages=[
                {"role": "system", "content": SYSTEM_PROMPT},
                {"role": "user", "content": ctx},
            ],
            json_mode=True,
            max_tokens=500,
        )
        parsed = self._safe_parse(raw, patient)

        row = AiInsight(
            patient_id=patient_id,
            category="chart_summary",
            title=f"Chart summary: {patient.first_name} {patient.last_name}",
            summary=parsed["summary"],
            confidence=parsed["confidence"],
            model=llm_client.chat_model,
            actions={"bullets": parsed["bullets"]},
            content_hash=chart_hash,
        )
        self.db.add(row)
        await self.db.flush()
        await self.db.refresh(row)

        return AiSummaryResponse(
            patient_id=patient_id,
            summary=parsed["summary"],
            bullets=parsed["bullets"],
            confidence=parsed["confidence"],
            model=llm_client.chat_model,
            generated_at=row.created_at,
            cached=False,
        )
```

Also add the import at the top of `summary.py` if missing:

```python
from app.ai.chart_hash import compute_chart_hash
from app.models.ai_insight import AiInsight
```

- [ ] **Step 4: Run the tests — expect green**

```bash
cd backend && pytest tests/ai/test_summary_cache.py -v
```

Expected: 3 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/ai/summary.py backend/tests/ai/test_summary_cache.py
git commit -m "feat(ai): cache chart summaries in ai_insight, support ?force regenerate"
```

---

### Task 9: Wire cache layer into `RiskService.score`

**Files:**
- Modify: `backend/app/ai/risk.py`

- [ ] **Step 1: Replace the entire file content**

Replace `backend/app/ai/risk.py` with:

```python
"""Lightweight rule + LLM hybrid risk scoring.

Returns a 0-100 risk score with categorical level and drivers.
Cached in ai_insight using compute_chart_hash so repeated chart opens
don't re-run the (cheap) rule pass + (less-cheap) LLM model call.
"""
from __future__ import annotations

from datetime import date as _date
from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.chart_hash import compute_chart_hash
from app.ai.llm import llm_client
from app.models.ai_insight import AiInsight
from app.models.allergy import Allergy
from app.models.condition import Condition
from app.models.lab_result import LabResult
from app.models.medication import Medication
from app.models.patient import Patient
from app.schemas.ai import AiRiskScoreResponse


HIGH_RISK_CONDITIONS = {
    "diabetes",
    "hypertension",
    "chf",
    "copd",
    "ckd",
    "afib",
    "cad",
}
ANTICOAG_KEYWORDS = {"apixaban", "warfarin", "rivaroxaban", "dabigatran"}


class RiskService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def score(
        self, patient_id: UUID, *, force: bool = False
    ) -> AiRiskScoreResponse:
        patient = await self.db.get(Patient, patient_id)
        if not patient:
            raise ValueError("Patient not found")

        conditions = (
            await self.db.execute(select(Condition).where(Condition.patient_id == patient_id))
        ).scalars().all()
        meds = (
            await self.db.execute(select(Medication).where(Medication.patient_id == patient_id))
        ).scalars().all()
        allergies = (
            await self.db.execute(select(Allergy).where(Allergy.patient_id == patient_id))
        ).scalars().all()
        labs = (
            await self.db.execute(
                select(LabResult)
                .where(LabResult.patient_id == patient_id)
                .order_by(LabResult.created_at.desc())
                .limit(10)
            )
        ).scalars().all()

        chart_hash = compute_chart_hash(
            patient=patient,
            allergies=allergies,
            conditions=conditions,
            medications=meds,
            labs=labs,
        )

        if not force:
            cached_row = (
                await self.db.execute(
                    select(AiInsight)
                    .where(
                        AiInsight.patient_id == patient_id,
                        AiInsight.category == "risk_score",
                        AiInsight.content_hash == chart_hash,
                    )
                    .order_by(AiInsight.created_at.desc())
                    .limit(1)
                )
            ).scalar_one_or_none()
            if cached_row is not None:
                actions = cached_row.actions or {}
                return AiRiskScoreResponse(
                    patient_id=patient_id,
                    risk_score=int(actions.get("risk_score", 0)),
                    risk_level=str(actions.get("risk_level", "low")),
                    drivers=list(actions.get("drivers") or []),
                    recommended_actions=list(actions.get("recommended_actions") or []),
                    model=cached_row.model,
                    generated_at=cached_row.created_at,
                    cached=True,
                )

        score = 0
        drivers: list[str] = []

        if patient.asa in {"III", "IV"}:
            score += 30
            drivers.append(f"ASA {patient.asa}")
        if patient.icu_needed:
            score += 15
            drivers.append("ICU required")

        for c in conditions:
            if any(k in (c.name or "").lower() for k in HIGH_RISK_CONDITIONS):
                score += 8
                drivers.append(f"Condition: {c.name}")

        for m in meds:
            if any(k in (m.name or "").lower() for k in ANTICOAG_KEYWORDS):
                score += 10
                drivers.append(f"Anticoagulant: {m.name}")

        if len(allergies) >= 2:
            score += 4
            drivers.append("Multiple allergies")

        if patient.dob:
            age = (_date.today() - patient.dob).days // 365
            if age >= 70:
                score += 12
                drivers.append(f"Age {age}")
            elif age >= 55:
                score += 6
                drivers.append(f"Age {age}")

        score = min(100, score)
        level = self._level(score)
        actions_list = self._actions(level, drivers)
        model_id = f"{llm_client.chat_model}+rules"

        row = AiInsight(
            patient_id=patient_id,
            category="risk_score",
            title=f"Risk score: {patient.first_name} {patient.last_name}",
            summary=f"{level.upper()} risk (score {score})",
            confidence=0.7,
            model=model_id,
            actions={
                "risk_score": score,
                "risk_level": level,
                "drivers": drivers[:6],
                "recommended_actions": actions_list,
            },
            content_hash=chart_hash,
        )
        self.db.add(row)
        await self.db.flush()
        await self.db.refresh(row)

        return AiRiskScoreResponse(
            patient_id=patient_id,
            risk_score=score,
            risk_level=level,
            drivers=drivers[:6],
            recommended_actions=actions_list,
            model=model_id,
            generated_at=row.created_at,
            cached=False,
        )

    @staticmethod
    def _level(score: int) -> str:
        if score >= 70:
            return "critical"
        if score >= 50:
            return "high"
        if score >= 25:
            return "moderate"
        return "low"

    @staticmethod
    def _actions(level: str, drivers: list[str]) -> list[str]:
        base = {
            "low": ["Continue standard pathway"],
            "moderate": ["Increase pre-op vitals frequency", "Review allergy list"],
            "high": [
                "ICU bed pre-allocation",
                "Anesthesia consult 48h pre-op",
                "Coagulation bridging plan",
            ],
            "critical": [
                "Multidisciplinary review required",
                "ICU bed mandatory",
                "Consider postponing if any criterion unmet",
            ],
        }
        actions = list(base.get(level, []))
        if any("Anticoagulant" in d for d in drivers):
            actions.append("Confirm anticoagulation pause window")
        return actions
```

- [ ] **Step 2: Verify imports**

```bash
cd backend && python -c "from app.ai.risk import RiskService; print('ok')"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add backend/app/ai/risk.py
git commit -m "feat(ai): cache risk scores in ai_insight, support force regenerate"
```

---

## Phase 3 — chart-context endpoint + audit logging

### Task 10: Implement `ChartContextService` (with TDD)

**Files:**
- Create: `backend/app/ai/chart_context.py`
- Test: `backend/tests/ai/test_chart_context.py`

- [ ] **Step 1: Write the failing integration test**

Create `backend/tests/ai/test_chart_context.py`:

```python
"""Integration: GET /ai/chart-context/:id returns both summary + risk
+ ai_alerts_count in one shot."""
from __future__ import annotations

import pytest
from sqlalchemy import select

from app.ai.chart_context import ChartContextService
from app.models.alert import AlertSeverity, AlertSource, PatientAlert


@pytest.mark.asyncio
async def test_chart_context_returns_summary_risk_and_alert_count(
    db_session, sample_patient
):
    # seed one AI-source alert
    db_session.add(
        PatientAlert(
            patient_id=sample_patient.id,
            label="Penicillin allergy",
            severity=AlertSeverity.warning,
            source=AlertSource.ai,
        )
    )
    await db_session.flush()

    svc = ChartContextService(db_session)
    res = await svc.get(sample_patient.id)

    assert res.summary.patient_id == sample_patient.id
    assert res.risk.patient_id == sample_patient.id
    assert res.ai_alerts_count == 1


@pytest.mark.asyncio
async def test_chart_context_ignores_resolved_ai_alerts(
    db_session, sample_patient
):
    db_session.add(
        PatientAlert(
            patient_id=sample_patient.id,
            label="Old allergy",
            severity=AlertSeverity.warning,
            source=AlertSource.ai,
            resolved=True,
        )
    )
    await db_session.flush()

    svc = ChartContextService(db_session)
    res = await svc.get(sample_patient.id)
    assert res.ai_alerts_count == 0


@pytest.mark.asyncio
async def test_chart_context_ignores_manual_alerts(
    db_session, sample_patient
):
    db_session.add(
        PatientAlert(
            patient_id=sample_patient.id,
            label="DNR",
            severity=AlertSeverity.warning,
            source=AlertSource.manual,
        )
    )
    await db_session.flush()

    svc = ChartContextService(db_session)
    res = await svc.get(sample_patient.id)
    assert res.ai_alerts_count == 0
```

- [ ] **Step 2: Run — expect failure**

```bash
cd backend && pytest tests/ai/test_chart_context.py -v
```

Expected: `ModuleNotFoundError: No module named 'app.ai.chart_context'`

- [ ] **Step 3: Implement the service**

Create `backend/app/ai/chart_context.py`:

```python
"""Aggregator service for the patient-chart AI panel.

Returns summary + risk_score (each cache-aware) + a count of
unresolved AI-source alerts. One round-trip from the frontend; both
LLM calls fan out in parallel inside `get()`."""
from __future__ import annotations

import asyncio
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.ai.risk import RiskService
from app.ai.summary import SummaryService
from app.models.alert import AlertSource, PatientAlert
from app.schemas.ai import AiChartContextResponse


class ChartContextService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get(
        self, patient_id: UUID, *, force: bool = False
    ) -> AiChartContextResponse:
        summary_task = SummaryService(self.db).for_patient(patient_id, force=force)
        risk_task = RiskService(self.db).score(patient_id, force=force)
        ai_alerts_count_task = self._count_ai_alerts(patient_id)

        summary, risk, ai_alerts_count = await asyncio.gather(
            summary_task, risk_task, ai_alerts_count_task
        )

        return AiChartContextResponse(
            summary=summary,
            risk=risk,
            ai_alerts_count=ai_alerts_count,
        )

    async def _count_ai_alerts(self, patient_id: UUID) -> int:
        result = await self.db.execute(
            select(func.count(PatientAlert.id)).where(
                PatientAlert.patient_id == patient_id,
                PatientAlert.source == AlertSource.ai,
                PatientAlert.resolved.is_(False),
            )
        )
        return int(result.scalar_one())
```

- [ ] **Step 4: Add the response schema**

Append to `backend/app/schemas/ai.py`:

```python
class AiChartContextResponse(BaseModel):
    """One-shot aggregator for the patient-chart AI panel — summary +
    risk + count of unresolved AI alerts."""

    summary: AiSummaryResponse
    risk: AiRiskScoreResponse
    ai_alerts_count: int
```

- [ ] **Step 5: Run the tests**

```bash
cd backend && pytest tests/ai/test_chart_context.py -v
```

Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/app/ai/chart_context.py backend/tests/ai/test_chart_context.py backend/app/schemas/ai.py
git commit -m "feat(ai): add ChartContextService aggregating summary + risk + ai_alerts_count"
```

---

### Task 11: Wire up `/ai/chart-context/:id` endpoint, `?force`, and audit logging

**Files:**
- Modify: `backend/app/api/v1/endpoints/ai.py`

- [ ] **Step 1: Replace the endpoint file with the new wiring**

The full new content of `backend/app/api/v1/endpoints/ai.py`:

```python
from uuid import UUID

from fastapi import APIRouter, Query, Request
from pydantic import BaseModel

from app.ai.chart_context import ChartContextService
from app.ai.llm import llm_client
from app.ai.rag import RagService
from app.ai.risk import RiskService
from app.ai.scribe import ScribeService
from app.ai.summary import SummaryService
from app.api.deps import CurrentUser, DbSession
from app.schemas.ai import (
    AiChartContextResponse,
    AiIntakeSummaryRequest,
    AiIntakeSummaryResponse,
    AiQuestionRequest,
    AiQuestionResponse,
    AiRiskScoreResponse,
    AiSummaryRequest,
    AiSummaryResponse,
)
from app.services.audit_service import AuditService

router = APIRouter(prefix="/ai", tags=["ai"])


@router.post("/summary", response_model=AiSummaryResponse)
async def patient_summary(
    payload: AiSummaryRequest,
    request: Request,
    db: DbSession,
    current: CurrentUser,
    force: bool = Query(False, description="Bypass cache and recompute"),
) -> AiSummaryResponse:
    res = await SummaryService(db).for_patient(
        payload.patient_id, payload.style, force=force
    )
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="ai.summary",
        resource_type="patient",
        resource_id=str(payload.patient_id),
        payload={"model": res.model, "cached": res.cached},
    )
    return res


@router.get("/risk/{patient_id}", response_model=AiRiskScoreResponse)
async def patient_risk(
    patient_id: str,
    request: Request,
    db: DbSession,
    current: CurrentUser,
    force: bool = Query(False, description="Bypass cache and recompute"),
) -> AiRiskScoreResponse:
    pid = UUID(patient_id)
    res = await RiskService(db).score(pid, force=force)
    await AuditService(db).record_request(
        request,
        user_id=current.id,
        action="ai.risk",
        resource_type="patient",
        resource_id=str(pid),
        payload={"model": res.model, "cached": res.cached},
    )
    return res


@router.get(
    "/chart-context/{patient_id}",
    response_model=AiChartContextResponse,
)
async def chart_context(
    patient_id: str,
    request: Request,
    db: DbSession,
    current: CurrentUser,
    force: bool = Query(False, description="Bypass cache and recompute both"),
) -> AiChartContextResponse:
    """One-shot AI panel data for the patient chart — summary + risk +
    AI alert count. Both LLM calls run in parallel."""
    pid = UUID(patient_id)
    res = await ChartContextService(db).get(pid, force=force)
    audit = AuditService(db)
    await audit.record_request(
        request,
        user_id=current.id,
        action="ai.summary",
        resource_type="patient",
        resource_id=str(pid),
        payload={"model": res.summary.model, "cached": res.summary.cached},
    )
    await audit.record_request(
        request,
        user_id=current.id,
        action="ai.risk",
        resource_type="patient",
        resource_id=str(pid),
        payload={"model": res.risk.model, "cached": res.risk.cached},
    )
    return res


@router.post("/ask", response_model=AiQuestionResponse)
async def ask(
    payload: AiQuestionRequest, db: DbSession, current: CurrentUser
) -> AiQuestionResponse:
    return await RagService(db).ask(
        payload.question, patient_id=payload.patient_id, top_k=payload.top_k
    )


class ScribeRequest(BaseModel):
    transcript: str


@router.post("/scribe")
async def scribe(payload: ScribeRequest, current: CurrentUser) -> dict:
    return await ScribeService().transcript_to_soap(payload.transcript)


@router.post(
    "/intake-summary/{form_id}",
    response_model=AiIntakeSummaryResponse,
)
async def intake_summary(
    form_id: UUID,
    payload: AiIntakeSummaryRequest,
    db: DbSession,
    current: CurrentUser,  # noqa: ARG001
) -> AiIntakeSummaryResponse:
    return await SummaryService(db).summarize_intake_form(form_id, payload.style)


@router.get("/provider")
async def provider_info(current: CurrentUser) -> dict:  # noqa: ARG001
    return {
        "provider": llm_client.provider,
        "chat_model": llm_client.chat_model,
        "enabled": llm_client.enabled,
    }
```

- [ ] **Step 2: Smoke-test the route is registered**

```bash
cd backend && source .venv/bin/activate && python -c "
from app.api.v1.endpoints.ai import router
print([r.path for r in router.routes])
"
```

Expected: list includes `/ai/chart-context/{patient_id}`.

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/v1/endpoints/ai.py
git commit -m "feat(api): add /ai/chart-context, force param, audit logging on AI calls"
```

---

## Phase 4 — Intake propagation

### Task 12: Add `_propagate_intake_red_flags` to `FormRequestService` (TDD)

**Files:**
- Test: `backend/tests/forms/test_intake_propagation.py`
- Modify: `backend/app/services/form_request_service.py`

- [ ] **Step 1: Write the failing test**

Create `backend/tests/forms/test_intake_propagation.py`:

```python
"""On intake form approval, red flags must auto-create patient_alerts
with source='ai'. Failure of the LLM step must NOT roll back the
review. Duplicates (same label, same patient, source='ai', unresolved)
are skipped. Cap at 5 alerts per approval."""
from __future__ import annotations

from unittest.mock import patch

import pytest
from sqlalchemy import select

from app.models.alert import AlertSource, PatientAlert
from app.models.form_request import FormRequestStatus, FormType
from app.schemas.ai import AiIntakeSummaryResponse
from app.schemas.form_request import FormRequestReview
from app.services.form_request_service import FormRequestService


def _fake_summary(form_id, patient_id, *, red_flags: list[str]) -> AiIntakeSummaryResponse:
    from datetime import datetime, timezone

    return AiIntakeSummaryResponse(
        form_id=form_id,
        patient_id=patient_id,
        summary="test",
        bullets=[],
        red_flags=red_flags,
        follow_ups=[],
        confidence=0.8,
        model="test-model",
        generated_at=datetime.now(timezone.utc),
    )


@pytest.mark.asyncio
async def test_approving_intake_creates_ai_alerts(
    db_session, submitted_intake_form, provider_user
):
    flags = ["Penicillin allergy", "On warfarin"]

    async def stub(form_id, style="clinical"):
        return _fake_summary(form_id, submitted_intake_form.patient_id, red_flags=flags)

    with patch(
        "app.ai.summary.SummaryService.summarize_intake_form",
        side_effect=stub,
    ):
        await FormRequestService(db_session).review(
            submitted_intake_form.id,
            viewer_id=provider_user.id,
            payload=FormRequestReview(decision="completed"),
        )

    rows = (
        await db_session.execute(
            select(PatientAlert).where(
                PatientAlert.patient_id == submitted_intake_form.patient_id,
                PatientAlert.source == AlertSource.ai,
            )
        )
    ).scalars().all()
    labels = sorted(r.label for r in rows)
    assert labels == sorted(flags)


@pytest.mark.asyncio
async def test_duplicate_ai_alerts_skipped(
    db_session, submitted_intake_form, provider_user
):
    flags = ["Penicillin allergy"]

    async def stub(form_id, style="clinical"):
        return _fake_summary(form_id, submitted_intake_form.patient_id, red_flags=flags)

    with patch(
        "app.ai.summary.SummaryService.summarize_intake_form",
        side_effect=stub,
    ):
        # Approve once
        await FormRequestService(db_session).review(
            submitted_intake_form.id,
            viewer_id=provider_user.id,
            payload=FormRequestReview(decision="completed"),
        )
        # Approve again (same flag) — service is idempotent on dup AI alerts
        await FormRequestService(db_session).review(
            submitted_intake_form.id,
            viewer_id=provider_user.id,
            payload=FormRequestReview(decision="completed"),
        )

    count = (
        await db_session.scalar(
            select(__import__("sqlalchemy").func.count(PatientAlert.id)).where(
                PatientAlert.patient_id == submitted_intake_form.patient_id,
                PatientAlert.source == AlertSource.ai,
            )
        )
    )
    assert count == 1


@pytest.mark.asyncio
async def test_propagation_failure_does_not_block_review(
    db_session, submitted_intake_form, provider_user
):
    async def boom(form_id, style="clinical"):
        raise RuntimeError("LLM down")

    with patch(
        "app.services.form_request_service.SummaryService.summarize_intake_form",
        side_effect=boom,
    ):
        # Should not raise
        out = await FormRequestService(db_session).review(
            submitted_intake_form.id,
            viewer_id=provider_user.id,
            payload=FormRequestReview(decision="completed"),
        )
    assert out.status == "completed"


@pytest.mark.asyncio
async def test_at_most_five_ai_alerts(
    db_session, submitted_intake_form, provider_user
):
    flags = [f"Flag {i}" for i in range(10)]

    async def stub(form_id, style="clinical"):
        return _fake_summary(form_id, submitted_intake_form.patient_id, red_flags=flags)

    with patch(
        "app.ai.summary.SummaryService.summarize_intake_form",
        side_effect=stub,
    ):
        await FormRequestService(db_session).review(
            submitted_intake_form.id,
            viewer_id=provider_user.id,
            payload=FormRequestReview(decision="completed"),
        )

    count = await db_session.scalar(
        select(__import__("sqlalchemy").func.count(PatientAlert.id)).where(
            PatientAlert.patient_id == submitted_intake_form.patient_id,
            PatientAlert.source == AlertSource.ai,
        )
    )
    assert count == 5
```

> **Note on fixtures:** if `submitted_intake_form` and `provider_user` aren't already defined in `tests/conftest.py` or `tests/forms/conftest.py`, add them following the existing fixture patterns. A submitted-intake fixture needs a patient + form_request with `form_type=intake`, `status=submitted`, and a minimal valid `data` payload. Provider user just needs `role=provider`.

- [ ] **Step 2: Run — expect failures**

```bash
cd backend && pytest tests/forms/test_intake_propagation.py -v
```

Expected: failures (propagation logic doesn't exist yet).

- [ ] **Step 3: Add the propagation method to `FormRequestService`**

In `backend/app/services/form_request_service.py`, add this private method to the class (above `_project`):

```python
    # ---------------------------------------------------------- AI hooks

    _MAX_AI_ALERTS_PER_INTAKE = 5

    async def _propagate_intake_red_flags(
        self, *, form: FormRequest, viewer_id: UUID
    ) -> None:
        """On intake approval, run the AI summarizer and convert each
        red flag into a patient_alert with source='ai'. Best-effort —
        any failure is logged at warn level and swallowed so the
        review request still succeeds.

        Dedup: skip if the same (patient_id, label, source='ai',
        resolved=false) row already exists. Hard cap at 5 alerts per
        approval (the model can be chatty)."""
        from app.ai.summary import SummaryService
        from app.core.logging import get_logger
        from app.models.alert import AlertSeverity, AlertSource, PatientAlert
        from app.services.audit_service import AuditService

        log = get_logger(__name__)

        try:
            summary = await SummaryService(self.db).summarize_intake_form(form.id)
            audit = AuditService(self.db)

            created = 0
            for raw_flag in summary.red_flags:
                if created >= self._MAX_AI_ALERTS_PER_INTAKE:
                    break
                label = (raw_flag or "").strip()[:128]
                if not label:
                    continue

                exists = (
                    await self.db.execute(
                        select(PatientAlert).where(
                            PatientAlert.patient_id == form.patient_id,
                            PatientAlert.label == label,
                            PatientAlert.source == AlertSource.ai,
                            PatientAlert.resolved.is_(False),
                        )
                    )
                ).scalar_one_or_none()
                if exists is not None:
                    continue

                alert = PatientAlert(
                    patient_id=form.patient_id,
                    label=label,
                    detail=None,
                    severity=AlertSeverity.warning,
                    source=AlertSource.ai,
                    created_by_id=None,
                )
                self.db.add(alert)
                await self.db.flush()
                await audit.record(
                    user_id=viewer_id,
                    action="alert.create.ai",
                    resource_type="patient_alert",
                    resource_id=str(alert.id),
                    payload={"label": label, "form_id": str(form.id)},
                )
                created += 1
        except Exception as exc:  # pragma: no cover - best-effort
            log.warning(
                "intake_propagation_failed",
                form_id=str(form.id),
                error=str(exc),
            )
```

Then call it inside `review()`. Find:

```python
        next_status = (
            FormRequestStatus.completed
            if payload.decision == "completed"
            else FormRequestStatus.denied
        )
        row.status = next_status
        row.reviewed_at = datetime.now(timezone.utc)
        row.reviewed_by_user_id = viewer_id
        row.review_notes = payload.review_notes
```

After the existing task-close logic (the block that updates `task.status` when completing/denying), and BEFORE the final `await self.db.flush()` + `await self.db.refresh(row)` + `return await self._project(row)`, insert:

```python
        # AI side-effect — best-effort, runs after the workflow state
        # is set so any failure can't roll back the review.
        if (
            next_status == FormRequestStatus.completed
            and row.form_type == FormType.intake
        ):
            await self._propagate_intake_red_flags(form=row, viewer_id=viewer_id)
```

- [ ] **Step 4: Run the tests — expect green**

```bash
cd backend && pytest tests/forms/test_intake_propagation.py -v
```

Expected: 4 passed.

- [ ] **Step 5: Commit**

```bash
git add backend/app/services/form_request_service.py backend/tests/forms/test_intake_propagation.py
git commit -m "feat(forms): propagate intake red flags into patient_alerts as source=ai"
```

---

## Phase 5 — Frontend API + hook

### Task 13: Add `source` field to `alerts-api.ts`

**Files:**
- Modify: `frontend/src/features/patients/api/alerts-api.ts`

- [ ] **Step 1: Edit the file**

In `frontend/src/features/patients/api/alerts-api.ts`, add the new type and surface `source` end-to-end. Apply these edits:

After `export type AlertSeverity = "critical" | "warning" | "info";` add:

```ts
export type AlertSource = "manual" | "ai" | "system";
```

Find the `PatientAlert` interface and add the `source` field:

```ts
export interface PatientAlert {
  id: string;
  patientId: string;
  severity: AlertSeverity;
  source: AlertSource;
  label: string;
  detail: string | null;
  resolved: boolean;
  createdById: string | null;
  createdAt: string;
  updatedAt: string;
}
```

Find the `BackendAlertDto` interface and add:

```ts
interface BackendAlertDto {
  id: string;
  patient_id: string;
  severity: AlertSeverity;
  source?: AlertSource;
  label: string;
  detail?: string | null;
  resolved: boolean;
  created_by_id?: string | null;
  created_at: string;
  updated_at: string;
}
```

Find the `mapAlert` function and add the mapping:

```ts
function mapAlert(dto: BackendAlertDto): PatientAlert {
  return {
    id: dto.id,
    patientId: dto.patient_id,
    severity: dto.severity,
    source: dto.source ?? "manual",
    label: dto.label,
    detail: dto.detail ?? null,
    resolved: dto.resolved,
    createdById: dto.created_by_id ?? null,
    createdAt: dto.created_at,
    updatedAt: dto.updated_at,
  };
}
```

Find `alertToBackendDto` and add the field:

```ts
function alertToBackendDto(a: PatientAlert): BackendAlertDto {
  return {
    id: a.id,
    patient_id: a.patientId,
    severity: a.severity,
    source: a.source,
    label: a.label,
    detail: a.detail,
    resolved: a.resolved,
    created_by_id: a.createdById,
    created_at: a.createdAt,
    updated_at: a.updatedAt,
  };
}
```

- [ ] **Step 2: Run typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patients/api/alerts-api.ts
git commit -m "feat(alerts): expose source on PatientAlert"
```

---

### Task 14: Create `patients/api/ai-api.ts`

**Files:**
- Create: `frontend/src/features/patients/api/ai-api.ts`

- [ ] **Step 1: Write the file**

```ts
/**
 * AI endpoints scoped to the patient chart — summary + risk + the
 * aggregator that powers the auto-on-open AI panel.
 */
import { api } from "@/lib/api-client";

export type RiskLevel = "low" | "moderate" | "high" | "critical";

export interface PatientChartSummary {
  patientId: string;
  summary: string;
  bullets: string[];
  confidence: number;
  model: string;
  generatedAt: string;
  cached: boolean;
}

export interface PatientRisk {
  patientId: string;
  riskScore: number;
  riskLevel: RiskLevel;
  drivers: string[];
  recommendedActions: string[];
  model: string;
  generatedAt: string;
  cached: boolean;
}

export interface PatientChartContext {
  summary: PatientChartSummary;
  risk: PatientRisk;
  aiAlertsCount: number;
}

interface SummaryDto {
  patient_id: string;
  summary: string;
  bullets: string[];
  confidence: number;
  model: string;
  generated_at: string;
  cached: boolean;
}

interface RiskDto {
  patient_id: string;
  risk_score: number;
  risk_level: RiskLevel;
  drivers: string[];
  recommended_actions: string[];
  model: string;
  generated_at: string;
  cached: boolean;
}

interface ChartContextDto {
  summary: SummaryDto;
  risk: RiskDto;
  ai_alerts_count: number;
}

function mapSummary(d: SummaryDto): PatientChartSummary {
  return {
    patientId: d.patient_id,
    summary: d.summary,
    bullets: d.bullets,
    confidence: d.confidence,
    model: d.model,
    generatedAt: d.generated_at,
    cached: d.cached,
  };
}

function mapRisk(d: RiskDto): PatientRisk {
  return {
    patientId: d.patient_id,
    riskScore: d.risk_score,
    riskLevel: d.risk_level,
    drivers: d.drivers,
    recommendedActions: d.recommended_actions,
    model: d.model,
    generatedAt: d.generated_at,
    cached: d.cached,
  };
}

export const patientsAiApi = {
  getChartContext: async (
    patientId: string,
    opts?: { force?: boolean }
  ): Promise<PatientChartContext> => {
    const dto = await api.get<ChartContextDto>(
      `/ai/chart-context/${patientId}`,
      {
        searchParams: opts?.force ? { force: "true" } : undefined,
      }
    );
    return {
      summary: mapSummary(dto.summary),
      risk: mapRisk(dto.risk),
      aiAlertsCount: dto.ai_alerts_count,
    };
  },

  regenerateSummary: async (patientId: string): Promise<PatientChartSummary> => {
    const dto = await api.post<SummaryDto>("/ai/summary", {
      patient_id: patientId,
      style: "clinical",
    }, {
      searchParams: { force: "true" },
    });
    return mapSummary(dto);
  },

  regenerateRisk: async (patientId: string): Promise<PatientRisk> => {
    const dto = await api.get<RiskDto>(`/ai/risk/${patientId}`, {
      searchParams: { force: "true" },
    });
    return mapRisk(dto);
  },
};
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patients/api/ai-api.ts
git commit -m "feat(patients): add ai-api client for chart-context + regenerate"
```

---

### Task 15: Create `use-chart-ai` hook

**Files:**
- Create: `frontend/src/features/patients/hooks/use-chart-ai.ts`

- [ ] **Step 1: Write the hook**

```ts
/**
 * Auto-fetches the AI chart context (summary + risk + ai_alerts_count)
 * when the patient profile mounts. The server cache is authoritative
 * for freshness — the client never hides a refetch behind a staleTime.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { patientsAiApi, type PatientChartContext } from "../api/ai-api";
import { toast } from "@/lib/toast";

const KEY = ["patient", "chart-ai"] as const;

export function chartAiKey(patientId: string | undefined) {
  return [...KEY, patientId];
}

export function useChartAi(patientId: string | undefined) {
  return useQuery<PatientChartContext>({
    queryKey: chartAiKey(patientId),
    queryFn: () => patientsAiApi.getChartContext(patientId as string),
    enabled: Boolean(patientId),
    staleTime: 0,
    gcTime: 30 * 60 * 1000,
    retry: 1,
  });
}

export function useRegenerateSummary(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => patientsAiApi.regenerateSummary(patientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chartAiKey(patientId) });
      toast.success("Summary regenerated");
    },
    onError: (err) =>
      toast.error("Couldn't regenerate summary", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}

export function useRegenerateRisk(patientId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => patientsAiApi.regenerateRisk(patientId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: chartAiKey(patientId) });
      toast.success("Risk score regenerated");
    },
    onError: (err) =>
      toast.error("Couldn't regenerate risk", {
        description: err instanceof Error ? err.message : undefined,
      }),
  });
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patients/hooks/use-chart-ai.ts
git commit -m "feat(patients): add useChartAi + regenerate hooks"
```

---

## Phase 6 — Frontend components

### Task 16: Build `PatientAiSummary` component

**Files:**
- Create: `frontend/src/features/patients/components/PatientAiSummary.tsx`

- [ ] **Step 1: Write the component**

```tsx
/**
 * Auto-loading collapsible AI summary card mounted at the top of the
 * patient profile (below PatientHeader, above AlertsStrip). Mirrors
 * the IntakeAiSummary visual pattern so the chart and intake flows
 * look like one cohesive AI surface.
 */
import { useState } from "react";
import { ChevronDown, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { useChartAi, useRegenerateSummary } from "../hooks/use-chart-ai";
import { Button } from "@/components/ui/button";
import { AiTag } from "@/components/ui/ai-tag";
import { cn, formatDate } from "@/lib/utils";

interface Props {
  patientId: string;
}

export function PatientAiSummary({ patientId }: Props) {
  const [collapsed, setCollapsed] = useState(false);
  const { data, isLoading, isError } = useChartAi(patientId);
  const regen = useRegenerateSummary(patientId);

  if (isLoading) {
    return (
      <section className="no-print rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4">
        <div className="flex items-center gap-3">
          <Loader2 className="size-4 animate-spin text-primary" />
          <span className="text-sm font-medium">Generating clinical summary…</span>
        </div>
      </section>
    );
  }

  if (isError || !data) {
    // Fail-soft: hide the panel entirely so it doesn't block the chart.
    return null;
  }

  const summary = data.summary;
  const confidencePct = Math.round(summary.confidence * 100);

  return (
    <section className="no-print rounded-2xl border border-primary/30 bg-primary/5 px-4 py-4 space-y-3">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-expanded={!collapsed}
          aria-controls={`patient-ai-summary-${patientId}`}
          className="flex items-start gap-2 min-w-0 text-left flex-1 rounded-lg -m-1 p-1 hover:bg-primary/5 transition"
        >
          <Sparkles className="size-4 text-primary mt-0.5 shrink-0" />
          <div className="min-w-0">
            <div className="text-sm font-semibold flex items-center gap-2 flex-wrap">
              AI clinical summary
              <AiTag>{summary.model}</AiTag>
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                · {confidencePct}% confidence
              </span>
              {summary.cached && (
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                  · cached
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Generated {formatDate(summary.generatedAt)}. AI-generated — verify with the patient before clinical decisions.
            </p>
          </div>
          <ChevronDown
            className={cn(
              "size-4 text-muted-foreground shrink-0 mt-1 transition-transform",
              collapsed && "-rotate-90"
            )}
            aria-hidden
          />
        </button>
        <Button
          size="sm"
          variant="secondary"
          className="h-7 text-xs"
          onClick={() => regen.mutate()}
          disabled={regen.isPending}
        >
          {regen.isPending ? (
            <Loader2 className="size-3 animate-spin" />
          ) : (
            <RefreshCw className="size-3" />
          )}{" "}
          Regenerate
        </Button>
      </div>

      {!collapsed && (
        <div id={`patient-ai-summary-${patientId}`} className="space-y-3">
          <p className="text-sm leading-relaxed">{summary.summary}</p>

          {summary.bullets.length > 0 && (
            <ul className="space-y-1 text-sm">
              {summary.bullets.map((b, i) => (
                <li key={i} className="flex gap-2 leading-snug">
                  <span className="mt-1.5 size-1 rounded-full shrink-0 bg-muted-foreground" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patients/components/PatientAiSummary.tsx
git commit -m "feat(patients): add PatientAiSummary card"
```

---

### Task 17: Build `PatientRiskDrawer`

**Files:**
- Create: `frontend/src/features/patients/components/PatientRiskDrawer.tsx`

- [ ] **Step 1: Write the component**

```tsx
/**
 * Drawer pop-up with risk score drivers + recommended actions.
 * Triggered by clicking the PatientRiskChip in the header.
 */
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Drawer } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { AiTag } from "@/components/ui/ai-tag";
import { cn } from "@/lib/utils";
import { useChartAi, useRegenerateRisk } from "../hooks/use-chart-ai";
import type { RiskLevel } from "../api/ai-api";

interface Props {
  patientId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const RISK_LEVEL_TONE: Record<RiskLevel, string> = {
  low: "bg-success/10 text-success",
  moderate: "bg-warning/10 text-warning",
  high: "bg-danger/10 text-danger",
  critical: "bg-danger/15 text-danger",
};

const RISK_LEVEL_LABEL: Record<RiskLevel, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
};

export function PatientRiskDrawer({ patientId, open, onOpenChange }: Props) {
  const { data } = useChartAi(patientId);
  const regen = useRegenerateRisk(patientId);
  const risk = data?.risk;

  return (
    <Drawer
      open={open}
      onOpenChange={onOpenChange}
      title="Risk score"
      side="right"
    >
      {!risk ? (
        <div className="text-sm text-muted-foreground py-8 text-center">
          Loading…
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex items-center gap-3">
            <div
              className={cn(
                "rounded-2xl px-4 py-3 flex items-center gap-3",
                RISK_LEVEL_TONE[risk.riskLevel]
              )}
            >
              <div className="text-3xl font-bold">{risk.riskScore}</div>
              <div className="text-sm font-semibold uppercase tracking-wider">
                {RISK_LEVEL_LABEL[risk.riskLevel]}
              </div>
            </div>
            <AiTag>{risk.model}</AiTag>
          </div>

          {risk.drivers.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">
                Drivers
              </div>
              <ul className="space-y-1 text-sm">
                {risk.drivers.map((d, i) => (
                  <li key={i} className="flex gap-2 leading-snug">
                    <span className="mt-1.5 size-1 rounded-full shrink-0 bg-muted-foreground" />
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {risk.recommendedActions.length > 0 && (
            <section>
              <div className="text-[10px] uppercase tracking-wider text-primary font-semibold mb-2 inline-flex items-center gap-1">
                <Sparkles className="size-3" /> Recommended actions
              </div>
              <ul className="space-y-1 text-sm">
                {risk.recommendedActions.map((a, i) => (
                  <li key={i} className="flex gap-2 leading-snug">
                    <span className="mt-1.5 size-1 rounded-full shrink-0 bg-primary" />
                    <span>{a}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Button
            variant="secondary"
            size="sm"
            onClick={() => regen.mutate()}
            disabled={regen.isPending}
            className="w-full"
          >
            {regen.isPending ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}{" "}
            Regenerate
          </Button>
        </div>
      )}
    </Drawer>
  );
}
```

> If your `Drawer` component takes different prop names (e.g. `direction` instead of `side`), inspect `frontend/src/components/ui/drawer.tsx` and adjust — the rest of the component is portable.

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0. Fix prop mismatches against the actual `Drawer` API if any.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patients/components/PatientRiskDrawer.tsx
git commit -m "feat(patients): add PatientRiskDrawer for risk drivers + actions"
```

---

### Task 18: Build `PatientRiskChip`

**Files:**
- Create: `frontend/src/features/patients/components/PatientRiskChip.tsx`

- [ ] **Step 1: Write the component**

```tsx
/**
 * Color-coded risk pill rendered inside PatientHeader. Click opens
 * PatientRiskDrawer. Shows a skeleton while the chart-AI fetch is
 * in flight; hides entirely if the fetch fails.
 */
import { useState } from "react";
import { useChartAi } from "../hooks/use-chart-ai";
import { PatientRiskDrawer, RISK_LEVEL_TONE } from "./PatientRiskDrawer";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

interface Props {
  patientId: string;
}

const LEVEL_LABEL = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
} as const;

export function PatientRiskChip({ patientId }: Props) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { data, isLoading, isError } = useChartAi(patientId);

  if (isLoading) {
    return (
      <span className="inline-flex h-6 w-24 animate-pulse rounded-full bg-muted/60" />
    );
  }
  if (isError || !data) return null;
  const r = data.risk;

  return (
    <>
      <button
        type="button"
        onClick={() => setDrawerOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold transition hover:brightness-95",
          RISK_LEVEL_TONE[r.riskLevel]
        )}
        title="Click for drivers + recommended actions"
      >
        <Sparkles className="size-3" />
        Risk {r.riskScore} · {LEVEL_LABEL[r.riskLevel]}
      </button>
      <PatientRiskDrawer
        patientId={patientId}
        open={drawerOpen}
        onOpenChange={setDrawerOpen}
      />
    </>
  );
}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patients/components/PatientRiskChip.tsx
git commit -m "feat(patients): add PatientRiskChip in patient header"
```

---

### Task 19: Add Sparkles affordance to `AlertsStrip`

**Files:**
- Modify: `frontend/src/features/patients/components/AlertsStrip.tsx`

- [ ] **Step 1: Inspect the existing render path**

Open `AlertsStrip.tsx` and locate where individual alert chips render the alert label (search for `alert.label` or the per-alert map function).

- [ ] **Step 2: Add the import**

At the top, add:

```ts
import { Sparkles } from "lucide-react";
```

- [ ] **Step 3: Render the sparkles inline next to label when `alert.source === "ai"`**

Find the JSX that emits each alert label (it will look something like `{alert.label}` inside a chip wrapper) and replace with:

```tsx
{alert.source === "ai" && (
  <Sparkles
    className="size-3 text-primary shrink-0"
    aria-label="AI-generated alert"
  />
)}
{alert.label}
```

- [ ] **Step 4: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/features/patients/components/AlertsStrip.tsx
git commit -m "feat(alerts): show sparkles icon on AI-source alerts in strip"
```

---

### Task 20: Add Sparkles affordance to `ImportantAlerts`

**Files:**
- Modify: `frontend/src/features/patients/components/ImportantAlerts.tsx`

- [ ] **Step 1: Same pattern as Task 19**

Add `import { Sparkles } from "lucide-react";` and render the icon next to each alert's label when `alert.source === "ai"`:

```tsx
{alert.source === "ai" && (
  <Sparkles
    className="size-3 text-primary shrink-0"
    aria-label="AI-generated alert"
  />
)}
{alert.label}
```

- [ ] **Step 2: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/features/patients/components/ImportantAlerts.tsx
git commit -m "feat(alerts): show sparkles icon on AI-source alerts in ImportantAlerts"
```

---

### Task 21: Mount `PatientRiskChip` in `PatientHeader`

**Files:**
- Modify: `frontend/src/features/patients/components/PatientHeader.tsx`

- [ ] **Step 1: Add the import**

```ts
import { PatientRiskChip } from "./PatientRiskChip";
```

- [ ] **Step 2: Render the chip**

Find the JSX section where existing badges/chips render (typically next to the patient name). Insert `<PatientRiskChip patientId={patient.id} />` alongside them.

- [ ] **Step 3: Typecheck**

```bash
cd frontend && npx tsc --noEmit
```

Expected: exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/patients/components/PatientHeader.tsx
git commit -m "feat(patients): mount PatientRiskChip in patient header"
```

---

### Task 22: Mount `PatientAiSummary` in `PatientProfilePage`

**Files:**
- Modify: `frontend/src/features/patients/PatientProfilePage.tsx`

- [ ] **Step 1: Add the import**

```ts
import { PatientAiSummary } from "./components/PatientAiSummary";
```

- [ ] **Step 2: Insert the component**

In the JSX, find the rendering of `<AlertsStrip patientId={patient.id} />`. Insert `<PatientAiSummary patientId={patient.id} />` directly above it (so the order becomes: PatientHeader → PatientAiSummary → AlertsStrip).

```tsx
<PatientAiSummary patientId={patient.id} />
<AlertsStrip patientId={patient.id} />
```

- [ ] **Step 3: Typecheck + lint**

```bash
cd frontend && npx tsc --noEmit && npx eslint src/features/patients --cache
```

Expected: both exit 0.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/features/patients/PatientProfilePage.tsx
git commit -m "feat(patients): mount PatientAiSummary above AlertsStrip on profile page"
```

---

## Phase 7 — Verification

### Task 23: End-to-end smoke test (manual)

**Files:** none — manual verification

- [ ] **Step 1: Start backend**

```bash
cd backend && source .venv/bin/activate && uvicorn app.main:app --reload
```

- [ ] **Step 2: Set `LLM_PROVIDER=groq` in `backend/.env` and restart**

Confirm via:

```bash
curl http://localhost:8000/api/v1/ai/provider -H "Authorization: Bearer <token>"
```

Expected: `{"provider":"groq","chat_model":"llama-3.3-70b-versatile","enabled":true}`

- [ ] **Step 3: Hit chart-context on a real patient**

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8000/api/v1/ai/chart-context/<patient-uuid> | jq
```

Expected: JSON with `summary` (cached=false on first call), `risk`, and `ai_alerts_count: 0`.

- [ ] **Step 4: Repeat the same call**

Expected: same JSON, but both `cached` fields are now `true`.

- [ ] **Step 5: Force-regenerate**

```bash
curl -H "Authorization: Bearer <token>" "http://localhost:8000/api/v1/ai/chart-context/<patient-uuid>?force=true" | jq
```

Expected: both `cached` flags are `false` again.

- [ ] **Step 6: Approve an intake form for that patient**

Use the staff portal: open a submitted intake → click "Mark Completed".

Then re-hit chart-context — `ai_alerts_count` should now be > 0 (number of red flags from the intake summary, capped at 5).

- [ ] **Step 7: Open patient profile in the staff portal**

Visual check:
- `PatientAiSummary` card renders at top, with summary + bullets
- `PatientRiskChip` renders in header with correct color (green/amber/red)
- Clicking the chip opens the drawer with drivers + actions
- `AlertsStrip` shows Sparkles icon next to AI-sourced alerts
- "Regenerate" buttons work end-to-end

- [ ] **Step 8: Confirm no regressions**

```bash
cd backend && pytest tests/ai/ tests/forms/ -v
cd frontend && npx tsc --noEmit && npx eslint src --cache
```

Both must pass.

---

## Self-review checklist

1. **Spec coverage** — every user story (US-CHART-AI-1..5) and every AC mapped to at least one task: ✓
2. **Placeholder scan** — every code step contains full code; no TBD / "implement later" / "similar to": ✓
3. **Type consistency** — `RiskLevel` is `"low" | "moderate" | "high" | "critical"` everywhere (`RISK_LEVEL_TONE`, schemas, tone map). `cached: bool` on both response schemas. `AlertSource` value `"ai"` everywhere.
4. **Scope** — single sub-project, one sprint, no decomposition needed.
