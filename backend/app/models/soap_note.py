from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import ForeignKey, Integer, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, TimestampMixin, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.user import User


class SoapNote(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "soap_notes"

    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    author_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    subjective: Mapped[str | None] = mapped_column(Text)
    objective: Mapped[str | None] = mapped_column(Text)
    assessment: Mapped[str | None] = mapped_column(Text)
    plan: Mapped[str | None] = mapped_column(Text)
    ai_summary: Mapped[str | None] = mapped_column(Text)
    version: Mapped[int] = mapped_column(Integer, default=1)
    # Set when this SOAP note was generated from a telehealth visit's
    # transcript. Lets us trace the draft back to its source.
    telehealth_session_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("telehealth_sessions.id", ondelete="SET NULL"),
        nullable=True,
    )

    patient: Mapped[Patient] = relationship(back_populates="notes")
    author: Mapped[User | None] = relationship(back_populates="notes")
