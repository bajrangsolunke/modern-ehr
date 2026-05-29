"""End-to-end smoke for the telehealth lifecycle.

Exercises TelehealthService -> TranscriptService -> SoapGeneratorService
with Daily REST and the LLM mocked, so the test runs without any
external credentials. Proves the BE pipeline composes end-to-end:

  1. Provider starts a session (creates Daily room + mints token).
  2. A few transcript segments are appended.
  3. A SOAP draft is generated from the transcript via the LLM.
  4. Provider ends the session.
"""
from __future__ import annotations

import uuid
from datetime import date, datetime, timezone
from unittest.mock import AsyncMock, patch

import pytest

from app.models.appointment import (
    Appointment,
    AppointmentStatus,
    AppointmentType,
)
from app.models.patient import Patient
from app.models.telehealth import TelehealthSessionStatus
from app.models.user import User, UserRole
from app.schemas.telehealth import TranscriptSegmentIn
from app.services.soap_generator_service import SoapGeneratorService
from app.services.telehealth_service import TelehealthService
from app.services.transcript_service import TranscriptService


@pytest.mark.asyncio
async def test_telehealth_pipeline(db_session) -> None:
    # ---- Arrange ----------------------------------------------------
    # Provider user (inline — the conftest has `provider_user` but we
    # keep this test self-contained so it's easy to read end-to-end).
    provider = User(
        email=f"provider-{uuid.uuid4()}@test.example",
        full_name="Dr. Test",
        hashed_password="$2b$12$test",
        role=UserRole.provider,
        is_active=True,
    )
    db_session.add(provider)
    await db_session.flush()

    patient = Patient(
        mrn=f"MRN-TH-{uuid.uuid4().hex[:8].upper()}",
        first_name="Test",
        last_name="Patient",
        sex="M",
        dob=date(1980, 1, 1),
    )
    db_session.add(patient)
    await db_session.flush()

    appt = Appointment(
        patient_id=patient.id,
        physician_id=provider.id,
        starts_at=datetime.now(timezone.utc),
        duration_minutes=30,
        status=AppointmentStatus.scheduled,
        type=AppointmentType.consultation,
    )
    db_session.add(appt)
    await db_session.flush()

    # ---- Mock Daily REST + DAILY_API_KEY ----------------------------
    fake_room = {"name": "abc123xyz", "url": "https://x.daily.co/abc123xyz"}
    with patch(
        "app.services.daily_client.DailyClient.create_room",
        new=AsyncMock(return_value=fake_room),
    ), patch(
        "app.services.daily_client.DailyClient.create_meeting_token",
        new=AsyncMock(return_value="tok_test"),
    ), patch(
        "app.services.daily_client.DailyClient.delete_room",
        new=AsyncMock(return_value=None),
    ), patch(
        # DailyClient.__init__ raises HTTPException(503) when the
        # configured DAILY_API_KEY is empty. Patch the symbol the
        # client reads (`settings.DAILY_API_KEY`) so the constructor
        # short-circuits to a usable key for the test.
        "app.services.daily_client.settings.DAILY_API_KEY",
        "test-key",
    ):
        # ---- Act 1: provider starts session ------------------------
        session, token = await TelehealthService(
            db_session
        ).get_or_create_for_appointment(
            appointment_id=appt.id,
            provider_id=provider.id,
            provider_name="Dr. Test",
        )
        assert session.daily_room_name == "abc123xyz"
        assert session.daily_room_url == fake_room["url"]
        assert token == "tok_test"
        # First-time create leaves status at `scheduled` (the service
        # only promotes to `active` when the patient had already
        # consented). The session is now usable either way.
        assert session.status in (
            TelehealthSessionStatus.scheduled,
            TelehealthSessionStatus.active,
        )
        assert session.provider_started_at is not None

        # ---- Act 2: append transcript segments ---------------------
        appended = await TranscriptService(db_session).append_batch(
            session.id,
            [
                TranscriptSegmentIn(
                    speaker_role="provider",
                    text="What brings you in today?",
                    start_offset_ms=0,
                ),
                TranscriptSegmentIn(
                    speaker_role="patient",
                    text="I've had a headache for three days.",
                    start_offset_ms=3500,
                ),
            ],
        )
        assert appended == 2

        segments = await TranscriptService(db_session).list_for_session(
            session.id
        )
        assert len(segments) == 2
        # Ordered by start_offset_ms ascending.
        assert segments[0].start_offset_ms == 0
        assert segments[1].start_offset_ms == 3500

        # ---- Act 3: generate SOAP (LLM mocked) ---------------------
        fake_json = (
            '{"subjective": "3-day headache.", '
            '"objective": "", '
            '"assessment": "Headache, etiology TBD.", '
            '"plan": "Rest, fluids, follow up in 1w."}'
        )
        with patch(
            "app.services.soap_generator_service.llm_client.chat",
            new=AsyncMock(return_value=fake_json),
        ):
            draft = await SoapGeneratorService(db_session).generate(
                session.id
            )

        assert "headache" in draft.subjective.lower()
        assert draft.assessment.startswith("Headache")
        assert draft.plan
        # Word count is summed across both transcript segments.
        assert draft.source_word_count > 0

        # ---- Act 4: end session ------------------------------------
        ended = await TelehealthService(db_session).end(session.id)
        assert ended.status == TelehealthSessionStatus.ended
        assert ended.ended_at is not None

        # Idempotent end — calling again is a no-op.
        ended_again = await TelehealthService(db_session).end(session.id)
        assert ended_again.status == TelehealthSessionStatus.ended
