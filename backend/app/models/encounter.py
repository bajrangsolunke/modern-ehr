from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient


class Encounter(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "encounters"

    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    encounter_type: Mapped[str] = mapped_column(String(64), default="visit")
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    chief_complaint: Mapped[str | None] = mapped_column(String(512))
    summary: Mapped[str | None] = mapped_column(Text)

    patient: Mapped[Patient] = relationship(back_populates="encounters")
