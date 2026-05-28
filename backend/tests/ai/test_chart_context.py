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
