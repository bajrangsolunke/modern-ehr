from __future__ import annotations

import enum
from datetime import date, datetime
from typing import TYPE_CHECKING
from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import ARRAY, Boolean, Date, DateTime, Enum, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.allergy import Allergy
    from app.models.appointment import Appointment
    from app.models.charge import Charge
    from app.models.condition import Condition
    from app.models.document import Document
    from app.models.encounter import Encounter
    from app.models.invoice import Invoice
    from app.models.lab_result import LabResult
    from app.models.medication import Medication
    from app.models.payment import Payment
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
    stripe_customer_id: Mapped[str | None] = mapped_column(String(64))
    # Holds either an http(s) URL or a data URL (small inline photo).
    avatar_url: Mapped[str | None] = mapped_column(Text)

    procedure: Mapped[str | None] = mapped_column(String(255))
    procedure_date: Mapped[date | None] = mapped_column(Date, index=True)
    asa: Mapped[str | None] = mapped_column(String(8))
    icu_needed: Mapped[bool] = mapped_column(default=False)

    status: Mapped[PatientStatus] = mapped_column(
        Enum(PatientStatus, name="patient_status"),
        default=PatientStatus.scheduled,
        index=True,
    )
    risk: Mapped[RiskLevel] = mapped_column(
        Enum(RiskLevel, name="risk_level"), default=RiskLevel.low, index=True
    )
    risk_score: Mapped[int] = mapped_column(Integer, default=0)
    tags: Mapped[list[str] | None] = mapped_column(ARRAY(String))
    # Controlled-vocabulary chip used for messaging filters, patient
    # roll-ups, and analytics. One value per patient — distinct from
    # `tags` which is free-form (#ASA II etc.).
    condition_tag: Mapped[str | None] = mapped_column(String(32), index=True)
    notes_internal: Mapped[str | None] = mapped_column(Text)

    # Patient portal auth — null until the patient activates via an
    # invite link. portal_active gates login independently of the
    # password being set (lets admins deactivate without wiping data).
    hashed_password: Mapped[str | None] = mapped_column(String(255))
    portal_active: Mapped[bool] = mapped_column(
        Boolean, nullable=False, default=False, server_default=sa.false()
    )
    email_verified_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    password_reset_token: Mapped[str | None] = mapped_column(
        String(128), index=True
    )
    password_reset_expires: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    assigned_physician_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
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
    charges: Mapped[list["Charge"]] = relationship(back_populates="patient")
    invoices: Mapped[list["Invoice"]] = relationship(back_populates="patient")
    payments: Mapped[list["Payment"]] = relationship(back_populates="patient")

    @property
    def full_name(self) -> str:
        return f"{self.first_name} {self.last_name}"
