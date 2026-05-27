from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.user import User


class AppointmentType(str, enum.Enum):
    consultation = "consultation"
    surgery = "surgery"
    diagnosis = "diagnosis"
    biopsy = "biopsy"
    follow_up = "follow-up"


class AppointmentStatus(str, enum.Enum):
    scheduled = "scheduled"
    confirmed = "confirmed"
    pending = "pending"
    completed = "completed"
    cancelled = "cancelled"
    no_show = "no-show"


class Appointment(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "appointments"

    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    physician_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    type: Mapped[AppointmentType] = mapped_column(
        Enum(AppointmentType, name="appointment_type"), default=AppointmentType.consultation
    )
    status: Mapped[AppointmentStatus] = mapped_column(
        Enum(AppointmentStatus, name="appointment_status"),
        default=AppointmentStatus.scheduled,
        index=True,
    )
    starts_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, index=True
    )
    duration_minutes: Mapped[int] = mapped_column(Integer, default=30)
    room: Mapped[str | None] = mapped_column(String(64))
    reason: Mapped[str | None] = mapped_column(String(512))

    patient: Mapped[Patient] = relationship(back_populates="appointments")
    physician: Mapped[User | None] = relationship(
        back_populates="appointments", foreign_keys=[physician_id]
    )
