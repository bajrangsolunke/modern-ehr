from __future__ import annotations

import enum
from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, Enum, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient


class MedicationStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    discontinued = "discontinued"


class Medication(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "medications"

    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    dose: Mapped[str] = mapped_column(String(64), nullable=False)
    frequency: Mapped[str] = mapped_column(String(64), nullable=False)
    route: Mapped[str] = mapped_column(String(32), default="oral")
    rxnorm: Mapped[str | None] = mapped_column(String(64))
    start_date: Mapped[date | None] = mapped_column(Date)
    end_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[MedicationStatus] = mapped_column(
        Enum(MedicationStatus, name="medication_status"), default=MedicationStatus.active
    )
    prescriber: Mapped[str | None] = mapped_column(String(255))

    patient: Mapped[Patient] = relationship(back_populates="medications")
