from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient


class Allergy(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "allergies"

    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    substance: Mapped[str] = mapped_column(String(255), nullable=False)
    reaction: Mapped[str | None] = mapped_column(String(255))
    severity: Mapped[str | None] = mapped_column(String(32))

    patient: Mapped[Patient] = relationship(back_populates="allergies")
