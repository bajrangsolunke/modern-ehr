from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from app.models.appointment import AppointmentStatus, AppointmentType


class AppointmentBase(BaseModel):
    patient_id: UUID
    physician_id: UUID | None = None
    type: AppointmentType = AppointmentType.consultation
    starts_at: datetime
    duration_minutes: int = Field(30, ge=5, le=480)
    room: str | None = None
    reason: str | None = None


class AppointmentCreate(AppointmentBase):
    status: AppointmentStatus = AppointmentStatus.scheduled


class AppointmentUpdate(BaseModel):
    status: AppointmentStatus | None = None
    starts_at: datetime | None = None
    duration_minutes: int | None = None
    room: str | None = None
    reason: str | None = None


class AppointmentOut(AppointmentBase):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    status: AppointmentStatus
