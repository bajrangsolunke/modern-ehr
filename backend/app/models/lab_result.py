from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient


class LabResult(Base, UUIDMixin):
    __tablename__ = "lab_results"

    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(128), nullable=False)
    loinc: Mapped[str | None] = mapped_column(String(32))
    value: Mapped[str] = mapped_column(String(64), nullable=False)
    unit: Mapped[str | None] = mapped_column(String(32))
    reference_range: Mapped[str | None] = mapped_column(String(64))
    flag: Mapped[str | None] = mapped_column(String(4))
    collected_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )

    patient: Mapped[Patient] = relationship(back_populates="labs")
