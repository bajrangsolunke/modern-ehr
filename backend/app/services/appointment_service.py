from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.appointment import Appointment
from app.schemas.appointment import AppointmentCreate, AppointmentUpdate


class AppointmentService:
    def __init__(self, db: AsyncSession) -> None:
        self.db = db

    async def create(self, payload: AppointmentCreate) -> Appointment:
        appt = Appointment(**payload.model_dump())
        self.db.add(appt)
        await self.db.flush()
        await self.db.refresh(appt)
        return appt

    async def get(self, appt_id: UUID) -> Appointment:
        appt = await self.db.get(Appointment, appt_id)
        if not appt:
            raise HTTPException(status_code=404, detail="Appointment not found")
        return appt

    async def update(self, appt_id: UUID, payload: AppointmentUpdate) -> Appointment:
        appt = await self.get(appt_id)
        for k, v in payload.model_dump(exclude_unset=True).items():
            setattr(appt, k, v)
        await self.db.flush()
        await self.db.refresh(appt)
        return appt

    async def list_for_patient(self, patient_id: UUID) -> list[Appointment]:
        result = await self.db.execute(
            select(Appointment)
            .where(Appointment.patient_id == patient_id)
            .order_by(Appointment.starts_at.desc())
        )
        return list(result.scalars().all())

    async def list_upcoming(self, limit: int = 50) -> list[Appointment]:
        result = await self.db.execute(
            select(Appointment).order_by(Appointment.starts_at.asc()).limit(limit)
        )
        return list(result.scalars().all())
