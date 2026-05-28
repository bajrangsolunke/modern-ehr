from __future__ import annotations

from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, Integer, Text, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin

if TYPE_CHECKING:
    from app.models.scribe_session import ScribeSession


class ScribeTranscript(Base, UUIDMixin):
    """One audio-chunk's worth of transcribed text. The denormalized
    `transcript_text` on the parent session is the source of truth the
    pipeline reads; this table is the audit log so we can replay /
    debug per-chunk if Whisper misbehaves."""

    __tablename__ = "scribe_transcripts"
    __table_args__ = (
        UniqueConstraint("session_id", "sequence", name="uq_scribe_transcripts_seq"),
    )

    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("scribe_sessions.id", ondelete="CASCADE"), index=True
    )
    sequence: Mapped[int] = mapped_column(Integer, nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session: Mapped[ScribeSession] = relationship(back_populates="transcripts")
