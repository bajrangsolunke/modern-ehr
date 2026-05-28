"""On intake form approval, red flags must auto-create patient_alerts
with source='ai'. Failure of the LLM step must NOT roll back the
review. Duplicates (same label, same patient, source='ai', unresolved)
are skipped. Cap at 5 alerts per approval."""
from __future__ import annotations

from unittest.mock import patch

import pytest
from sqlalchemy import func, select

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

    async def stub(self, form_id, style="clinical"):
        return _fake_summary(form_id, submitted_intake_form.patient_id, red_flags=flags)

    with patch(
        "app.ai.summary.SummaryService.summarize_intake_form",
        new=stub,
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

    async def stub(self, form_id, style="clinical"):
        return _fake_summary(form_id, submitted_intake_form.patient_id, red_flags=flags)

    with patch(
        "app.ai.summary.SummaryService.summarize_intake_form",
        new=stub,
    ):
        await FormRequestService(db_session).review(
            submitted_intake_form.id,
            viewer_id=provider_user.id,
            payload=FormRequestReview(decision="completed"),
        )
        await FormRequestService(db_session).review(
            submitted_intake_form.id,
            viewer_id=provider_user.id,
            payload=FormRequestReview(decision="completed"),
        )

    count = (
        await db_session.scalar(
            select(func.count(PatientAlert.id)).where(
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
    async def boom(self, form_id, style="clinical"):
        raise RuntimeError("LLM down")

    with patch(
        "app.ai.summary.SummaryService.summarize_intake_form",
        new=boom,
    ):
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

    async def stub(self, form_id, style="clinical"):
        return _fake_summary(form_id, submitted_intake_form.patient_id, red_flags=flags)

    with patch(
        "app.ai.summary.SummaryService.summarize_intake_form",
        new=stub,
    ):
        await FormRequestService(db_session).review(
            submitted_intake_form.id,
            viewer_id=provider_user.id,
            payload=FormRequestReview(decision="completed"),
        )

    count = await db_session.scalar(
        select(func.count(PatientAlert.id)).where(
            PatientAlert.patient_id == submitted_intake_form.patient_id,
            PatientAlert.source == AlertSource.ai,
        )
    )
    assert count == 5
