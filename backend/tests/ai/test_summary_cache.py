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
            AiInsight.category == "chart_summary:clinical",
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
            AiInsight.category == "chart_summary:clinical",
        )
    )
    assert count == 1


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
            AiInsight.category == "chart_summary:clinical",
        )
    )
    assert count == 2
