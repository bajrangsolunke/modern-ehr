"""Patient-scoped appointment views."""
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PatientAppointmentOut(BaseModel):
    id: UUID
    starts_at: datetime
    duration_minutes: int
    type: str
    status: str
    room: str | None = None
    reason: str | None = None
    provider_name: str | None = None
    provider_specialty: str | None = None


class PatientAppointmentListOut(BaseModel):
    upcoming: list[PatientAppointmentOut]
    past: list[PatientAppointmentOut]
