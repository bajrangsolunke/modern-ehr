"""Pydantic schemas for the Communication module."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


Audience = Literal["patient", "clinician"]


class ParticipantOut(BaseModel):
    """User who is part of a conversation."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str | None = None
    email: str | None = None
    role: str | None = None
    specialty: str | None = None
    avatar_url: str | None = None
    last_read_at: datetime | None = None


class PatientSummary(BaseModel):
    """Slim patient projection — drives the chat header strip."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    mrn: str | None = None
    dob: str | None = None
    age: int | None = None
    gender: str | None = None
    phone: str | None = None
    email: str | None = None
    avatar_url: str | None = None
    condition_tag: str | None = None


class AttachmentOut(BaseModel):
    """Slim document projection — drives the attachment chip + click-
    through to the docs preview modal."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    mime_type: str
    size_bytes: int
    category: str
    has_preview: bool = False


class MessageOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    conversation_id: UUID
    sender_user_id: UUID | None = None
    sender_patient_id: UUID | None = None
    body: str
    urgent: bool
    sent_at: datetime
    attachments: list[AttachmentOut] = Field(default_factory=list)


class ConversationOut(BaseModel):
    """List row — participant projection + last message snippet."""

    model_config = ConfigDict(from_attributes=True)

    id: UUID
    audience: Audience
    title: str | None = None
    last_message_at: datetime
    last_message_preview: str | None = None
    unread: int = 0
    patient: PatientSummary | None = None
    participants: list[ParticipantOut] = Field(default_factory=list)


class ConversationDetail(ConversationOut):
    """Single conversation + its messages."""

    messages: list[MessageOut] = Field(default_factory=list)


class SendMessageIn(BaseModel):
    body: str = Field(min_length=1, max_length=4000)
    urgent: bool = False
    document_ids: list[UUID] = Field(default_factory=list)


class CreatePatientConversationIn(BaseModel):
    patient_id: UUID
    body: str = Field(min_length=1, max_length=4000)
    urgent: bool = False


class CreateClinicianConversationIn(BaseModel):
    """One-to-one or group thread between staff users."""

    user_ids: list[UUID] = Field(min_length=1)
    body: str = Field(min_length=1, max_length=4000)
    urgent: bool = False


class MarkReadIn(BaseModel):
    last_read_at: datetime | None = None
