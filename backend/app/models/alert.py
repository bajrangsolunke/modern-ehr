from __future__ import annotations

import enum
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Boolean, Enum, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.user import User


class AlertSeverity(str, enum.Enum):
    critical = "critical"
    warning = "warning"
    info = "info"


class AlertSource(str, enum.Enum):
    """Where the alert came from. `manual` is the default (clinician-entered);
    `ai` flags rows produced by AI inference (intake red flags, etc.);
    `system` is reserved for deterministic rule output (future use)."""

    manual = "manual"
    ai = "ai"
    system = "system"


class PatientAlert(Base, UUIDMixin, TimestampMixin):
    """
    Patient-scoped clinical alert (e.g. blood thinner, DNR, falls risk).
    Surfaced as chips on the patient header so clinicians see them on
    every tab without hunting.
    """

    __tablename__ = "patient_alerts"

    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    severity: Mapped[AlertSeverity] = mapped_column(
        Enum(AlertSeverity, name="alert_severity"),
        default=AlertSeverity.info,
        nullable=False,
    )
    source: Mapped[AlertSource] = mapped_column(
        Enum(AlertSource, name="alert_source"),
        default=AlertSource.manual,
        nullable=False,
        index=True,
    )
    label: Mapped[str] = mapped_column(String(128), nullable=False)
    detail: Mapped[str | None] = mapped_column(Text)

    # Soft-resolve flag — keep the row for audit but hide from the strip.
    resolved: Mapped[bool] = mapped_column(
        Boolean, default=False, nullable=False, index=True
    )

    created_by_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL")
    )

    patient: Mapped[Patient] = relationship()
    created_by: Mapped[User | None] = relationship()
