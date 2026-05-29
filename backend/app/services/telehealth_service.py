"""TelehealthService — owns the lifecycle of a telehealth session.

Each appointment can have at most one session row (unique FK). The
service is intentionally narrow: create, get, end. Transcript
ingestion lives in TranscriptService; SOAP generation in
SoapGeneratorService.
"""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment
from app.models.telehealth import (
    TelehealthSession,
    TelehealthSessionStatus,
)
from app.services.daily_client import DailyClient


class TelehealthService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def get_or_create_for_appointment(
        self, *, appointment_id: UUID, provider_id: UUID, provider_name: str
    ) -> tuple[TelehealthSession, str]:
        """Idempotent: returns the existing session if one is already
        attached to the appointment; otherwise creates a new Daily
        room + DB row. Returns the session + the provider's join token
        (which is freshly minted every call — tokens are short-lived
        so we don't reuse them)."""
        appt = await self.db.get(Appointment, appointment_id)
        if appt is None:
            raise HTTPException(status_code=404, detail="Appointment not found")

        session = (
            await self.db.execute(
                select(TelehealthSession).where(
                    TelehealthSession.appointment_id == appointment_id
                )
            )
        ).scalar_one_or_none()

        client = DailyClient()
        if session is None:
            room = await client.create_room()
            session = TelehealthSession(
                appointment_id=appointment_id,
                daily_room_name=room["name"],
                daily_room_url=room["url"],
                status=TelehealthSessionStatus.scheduled,
            )
            self.db.add(session)
            await self.db.flush()

        # Mint a fresh provider token regardless — even on re-open.
        token = await client.create_meeting_token(
            room_name=session.daily_room_name,
            user_name=provider_name or "Provider",
            is_owner=True,
        )
        # Mark active on join — the visit has "started" when the
        # provider opens the call window.
        if session.provider_started_at is None:
            session.provider_started_at = datetime.now(timezone.utc)
        if session.status == TelehealthSessionStatus.patient_consented:
            session.status = TelehealthSessionStatus.active
        await self.db.flush()
        return session, token

    async def get(self, session_id: UUID) -> TelehealthSession:
        s = await self.db.get(TelehealthSession, session_id)
        if s is None:
            raise HTTPException(status_code=404, detail="Session not found")
        return s

    async def consent_and_mint_patient_token(
        self,
        *,
        appointment_id: UUID,
        patient_id: UUID,
        patient_name: str,
    ) -> tuple[TelehealthSession, str]:
        """Patient accepted the consent banner. Records the consent
        timestamp and mints a non-owner join token.

        If the session doesn't exist yet (provider hasn't clicked
        Start), we create it here — patient-initiated join is OK as
        long as the appointment is real and belongs to them."""
        appt = await self.db.get(Appointment, appointment_id)
        if appt is None or appt.patient_id != patient_id:
            raise HTTPException(status_code=404, detail="Appointment not found")

        session = (
            await self.db.execute(
                select(TelehealthSession).where(
                    TelehealthSession.appointment_id == appointment_id
                )
            )
        ).scalar_one_or_none()

        client = DailyClient()
        if session is None:
            room = await client.create_room()
            session = TelehealthSession(
                appointment_id=appointment_id,
                daily_room_name=room["name"],
                daily_room_url=room["url"],
                status=TelehealthSessionStatus.scheduled,
            )
            self.db.add(session)
            await self.db.flush()

        if session.patient_consented_at is None:
            session.patient_consented_at = datetime.now(timezone.utc)
        if session.status == TelehealthSessionStatus.scheduled:
            session.status = TelehealthSessionStatus.patient_consented
        await self.db.flush()

        token = await client.create_meeting_token(
            room_name=session.daily_room_name,
            user_name=patient_name or "Patient",
            is_owner=False,
        )
        return session, token

    async def end(self, session_id: UUID) -> TelehealthSession:
        s = await self.get(session_id)
        if s.status == TelehealthSessionStatus.ended:
            return s  # idempotent
        s.status = TelehealthSessionStatus.ended
        s.ended_at = datetime.now(timezone.utc)
        await self.db.flush()
        # Best-effort room cleanup — failures are logged inside the
        # client and don't bubble up.
        try:
            await DailyClient().delete_room(s.daily_room_name)
        except Exception:  # noqa: BLE001
            pass
        return s
