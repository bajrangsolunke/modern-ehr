"""
Conversation + Message + ConversationParticipant — Communication module.

Modeling notes:
  * `audience` distinguishes patient-side ("patient") from clinician-only
    ("clinician") threads. Patient threads have exactly one `patient_id`
    (the patient is the "other side"); clinician threads use the
    `ConversationParticipant` join table only.
  * Messages carry both possible senders — `sender_user_id` for staff
    and `sender_patient_id` for the patient. Exactly one is set on any
    given row. This avoids the impedance mismatch of a single FK to a
    polymorphic "person" table.
  * `urgent` mirrors the compose modal's Urgent flag and surfaces in the
    UI as a red priority badge.
"""

from __future__ import annotations

from datetime import datetime
from uuid import UUID

from sqlalchemy import Boolean, DateTime, ForeignKey, Index, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base, UUIDMixin


class Conversation(Base, UUIDMixin):
    __tablename__ = "conversations"

    audience: Mapped[str] = mapped_column(String(16), nullable=False, index=True)
    # Optional — only set for audience=="patient".
    patient_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("patients.id", ondelete="CASCADE"), nullable=True, index=True
    )
    # Optional human label (defaults to participant names in the UI).
    title: Mapped[str | None] = mapped_column(String(255))

    last_message_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), index=True
    )
    last_message_preview: Mapped[str | None] = mapped_column(Text)
    # The patient participates implicitly via `patient_id`, so we track
    # their read state here instead of in `conversation_participants`.
    # Null = patient has never opened the thread.
    patient_last_read_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True)
    )

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    participants: Mapped[list["ConversationParticipant"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )
    messages: Mapped[list["Message"]] = relationship(
        back_populates="conversation",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="Message.sent_at",
    )


class ConversationParticipant(Base, UUIDMixin):
    """Join row — every staff user in a conversation (1+ rows).

    Patient participation is implicit via Conversation.patient_id so we
    don't need patient rows here.
    """

    __tablename__ = "conversation_participants"

    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    user_id: Mapped[UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True
    )
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    conversation: Mapped[Conversation] = relationship(back_populates="participants")

    __table_args__ = (
        Index(
            "uq_conversation_participant",
            "conversation_id",
            "user_id",
            unique=True,
        ),
    )


class Message(Base, UUIDMixin):
    __tablename__ = "messages"

    conversation_id: Mapped[UUID] = mapped_column(
        ForeignKey("conversations.id", ondelete="CASCADE"), nullable=False, index=True
    )
    sender_user_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"), nullable=True
    )
    sender_patient_id: Mapped[UUID | None] = mapped_column(
        ForeignKey("patients.id", ondelete="SET NULL"), nullable=True
    )
    body: Mapped[str] = mapped_column(Text, nullable=False)
    urgent: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)

    sent_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False, index=True
    )

    conversation: Mapped[Conversation] = relationship(back_populates="messages")
    attachments: Mapped[list["MessageAttachment"]] = relationship(
        back_populates="message",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class MessageAttachment(Base, UUIDMixin):
    """Links a message to an existing document in the docs module."""

    __tablename__ = "message_attachments"

    message_id: Mapped[UUID] = mapped_column(
        ForeignKey("messages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    document_id: Mapped[UUID] = mapped_column(
        ForeignKey("documents.id", ondelete="CASCADE"), nullable=False, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )

    message: Mapped[Message] = relationship(back_populates="attachments")

    __table_args__ = (
        Index(
            "uq_message_attachment",
            "message_id",
            "document_id",
            unique=True,
        ),
    )
