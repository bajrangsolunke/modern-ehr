from __future__ import annotations

from datetime import date
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import Date, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient


class Condition(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "conditions"

    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    icd10: Mapped[str | None] = mapped_column(String(16))
    onset_date: Mapped[date | None] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(32), default="active")

    patient: Mapped[Patient] = relationship(back_populates="conditions")
