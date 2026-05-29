from __future__ import annotations

import enum
from datetime import datetime
from uuid import UUID

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin, TimestampMixin


class TelehealthSessionStatus(str, enum.Enum):
    """Lifecycle of a telehealth visit. `scheduled` until patient
    consents; `active` once the provider joins; `ended` after the
    provider clicks End. `cancelled` is for visits that never started."""

    scheduled = "scheduled"
    patient_consented = "patient_consented"
    active = "active"
    ended = "ended"
    cancelled = "cancelled"


class SpeakerRole(str, enum.Enum):
    provider = "provider"
    patient = "patient"
    unknown = "unknown"


class TelehealthSession(Base, UUIDMixin, TimestampMixin):
    __tablename__ = "telehealth_sessions"

    appointment_id: Mapped[UUID] = mapped_column(
        ForeignKey("appointments.id", ondelete="CASCADE"),
        nullable=False,
        unique=True,
    )
    # Short opaque room id from Daily — used to build the room URL +
    # as the joinable name in the iframe.
    daily_room_name: Mapped[str] = mapped_column(String(96), nullable=False, unique=True)
    daily_room_url: Mapped[str] = mapped_column(String(512), nullable=False)
    status: Mapped[TelehealthSessionStatus] = mapped_column(
        Enum(TelehealthSessionStatus, name="telehealth_session_status"),
        default=TelehealthSessionStatus.scheduled,
        nullable=False,
        index=True,
    )
    patient_consented_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    provider_started_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )
    ended_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    segments: Mapped[list["TranscriptSegment"]] = relationship(
        back_populates="session",
        cascade="all, delete-orphan",
        order_by="TranscriptSegment.start_offset_ms",
    )


class TranscriptSegment(Base, UUIDMixin):
    __tablename__ = "transcript_segments"

    session_id: Mapped[UUID] = mapped_column(
        ForeignKey("telehealth_sessions.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    speaker_role: Mapped[SpeakerRole] = mapped_column(
        Enum(SpeakerRole, name="telehealth_speaker_role"),
        nullable=False,
    )
    # Daily's `participantId` — we keep it so we can correlate
    # multiple segments from the same speaker even if their human
    # role isn't resolved at insert time.
    daily_participant_id: Mapped[str | None] = mapped_column(String(96))
    text: Mapped[str] = mapped_column(Text, nullable=False)
    # Milliseconds since the session's provider_started_at — used to
    # order the transcript deterministically without relying on
    # wall-clock timestamps from the client.
    start_offset_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    session: Mapped[TelehealthSession] = relationship(back_populates="segments")
