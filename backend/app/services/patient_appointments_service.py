"""Patient-facing appointments listing. Returns upcoming + past splits
for the authenticated patient only — no cross-patient access here."""
from __future__ import annotations

from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment
from app.models.user import User
from app.schemas.patient_portal_appointments import (
    PatientAppointmentListOut,
    PatientAppointmentOut,
)


class PatientAppointmentsService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def list_for_patient(self, patient_id: UUID) -> PatientAppointmentListOut:
        rows = (
            await self.db.execute(
                select(Appointment)
                .where(Appointment.patient_id == patient_id)
                .order_by(Appointment.starts_at.desc())
            )
        ).scalars().all()

        provider_ids = {r.physician_id for r in rows if r.physician_id}
        providers = {}
        if provider_ids:
            users = (
                await self.db.execute(
                    select(User).where(User.id.in_(provider_ids))
                )
            ).scalars().all()
            providers = {u.id: u for u in users}

        now = datetime.now(timezone.utc)
        upcoming: list[PatientAppointmentOut] = []
        past: list[PatientAppointmentOut] = []
        for row in rows:
            provider = providers.get(row.physician_id) if row.physician_id else None
            dto = PatientAppointmentOut(
                id=row.id,
                starts_at=row.starts_at,
                duration_minutes=row.duration_minutes,
                type=row.type.value,
                status=row.status.value,
                room=row.room,
                reason=row.reason,
                provider_name=provider.full_name if provider else None,
                provider_specialty=provider.specialty if provider else None,
            )
            if row.starts_at >= now:
                upcoming.append(dto)
            else:
                past.append(dto)

        upcoming.sort(key=lambda x: x.starts_at)
        return PatientAppointmentListOut(upcoming=upcoming, past=past)
