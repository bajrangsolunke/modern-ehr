from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.scribe_session import ScribeSession


class ScribeSoapNote(Base, UUIDMixin):
    """AI-drafted SOAP for an ambient-scribe session. Kept separate from
    the clinician-signed `soap_notes` table so we don't conflate drafts
    with formal notes — the provider can edit here, then optionally
    promote the result to a real SOAP note (handled in Phase 2)."""

    __tablename__ = "scribe_soap_notes"

    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("scribe_sessions.id", ondelete="CASCADE"), unique=True
    )
    subjective: Mapped[str] = mapped_column(Text, default="", nullable=False)
    objective: Mapped[str] = mapped_column(Text, default="", nullable=False)
    assessment: Mapped[str] = mapped_column(Text, default="", nullable=False)
    plan: Mapped[str] = mapped_column(Text, default="", nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    session: Mapped[ScribeSession] = relationship(back_populates="soap_note")
