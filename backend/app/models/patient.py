from __future__ import annotations

import enum
from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ARRAY, Date, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.allergy import Allergy
    from app.models.appointment import Appointment
    from app.models.condition import Condition
    from app.models.document import Document
    from app.models.encounter import Encounter
    from app.models.lab_result import LabResult
    from app.models.medication import Medication
    from app.models.soap_note import SoapNote
    from app.models.user import User
    from app.models.vital import VitalSign


class PatientStatus(str, enum.Enum):
    ready = "ready"
    at_risk = "at-risk"
    in_progress = "in-progress"
    discharged = "discharged"
    scheduled = "scheduled"


class RiskLevel(str, enum.Enum):
    low = "low"
    moderate = "moderate"
    high = "high"
    critical = "critical"


class Patient(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "patients"

    mrn: Mapped[str] = mapped_column(String(64), unique=True, index=True, nullable=False)
    first_name: Mapped[str] = mapped_column(String(128), nullable=False)
    last_name: Mapped[str] = mapped_column(String(128), nullable=False)
    sex: Mapped[str] = mapped_column(String(8), nullable=False)
    dob: Mapped[date] = mapped_column(Date, nullable=False)

    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(64))
    city: Mapped[str | None] = mapped_column(String(255))
    avatar_url: Mapped[str | None] = mapped_column(String(512))

    procedure: Mapped[str | None] = mapped_column(String(255))
    procedure_date: Mapped[date | None] = mapped_column(Date)
    asa: Mapped[str | None] = mapped_column(String(8))
    icu_needed: Mapped[bool] = mapped_column(default=False)

    status: Mapped[PatientStatus] = mapped_column(
        Enum(PatientStatus, name="patient_status"), default=PatientStatus.scheduled
    )
    risk: Mapped[RiskLevel] = mapped_column(
        Enum(RiskLevel, name="risk_level"), default=RiskLevel.low
    )
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    notes_internal: Mapped[str | None] = mapped_column(Text)

    assigned_physician_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    assigned_physician: Mapped[User | None] = relationship(foreign_keys=[assigned_physician_id])
    allergies: Mapped[list[Allergy]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    conditions: Mapped[list[Condition]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    medications: Mapped[list[Medication]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    vitals: Mapped[list[VitalSign]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    appointments: Mapped[list[Appointment]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    encounters: Mapped[list[Encounter]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    notes: Mapped[list[SoapNote]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    labs: Mapped[list[LabResult]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )
    documents: Mapped[list[Document]] = relationship(
        back_populates="patient", cascade="all, delete-orphan"
    )

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
