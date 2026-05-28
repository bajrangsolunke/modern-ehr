from __future__ import annotations

import enum
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, Enum, ForeignKey, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.patient import Patient
    from app.models.scribe_icd_suggestion import ScribeIcdSuggestion
    from app.models.scribe_soap_note import ScribeSoapNote
    from app.models.scribe_transcript import ScribeTranscript
    from app.models.user import User


class ScribeSessionStatus(str, enum.Enum):
    """Lifecycle stages of an ambient-scribe session.

    created → recording → processing → completed
                                     ↓
                                   failed
    """

    created = "created"
    recording = "recording"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class ScribeSession(Base, UUIDMixin):
    """One ambient-documentation session. Created when the provider hits
    "Start scribe" on a patient chart, completed when the finalize pipeline
    persists the SOAP / ICD / summary outputs."""

    __tablename__ = "scribe_sessions"

    user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), index=True
    )
    patient_id: Mapped[UUID] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), index=True
    )
    chief_complaint: Mapped[str | None] = mapped_column(String(512))
    status: Mapped[ScribeSessionStatus] = mapped_column(
        Enum(ScribeSessionStatus, name="scribe_session_status"),
        default=ScribeSessionStatus.created,
        nullable=False,
    )
    # Denormalized full transcript — the finalize pipeline reads this.
    # The transcripts table is the per-chunk audit log.
    transcript_text: Mapped[str] = mapped_column(Text, default="", nullable=False)
    visit_summary: Mapped[str | None] = mapped_column(Text)
    error_message: Mapped[str | None] = mapped_column(Text)

    started_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    patient: Mapped[Patient] = relationship()
    user: Mapped[User | None] = relationship()
    transcripts: Mapped[list[ScribeTranscript]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
    soap_note: Mapped[ScribeSoapNote | None] = relationship(
        back_populates="session", uselist=False, cascade="all, delete-orphan"
    )
    icd_suggestions: Mapped[list[ScribeIcdSuggestion]] = relationship(
        back_populates="session", cascade="all, delete-orphan"
    )
