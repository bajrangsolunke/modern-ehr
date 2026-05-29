"""Pydantic DTOs for the telehealth endpoints."""
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


SessionStatusLiteral = Literal[
    "scheduled", "patient_consented", "active", "ended", "cancelled"
]
SpeakerRoleLiteral = Literal["provider", "patient", "unknown"]


class TranscriptSegmentOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    session_id: UUID
    speaker_role: SpeakerRoleLiteral
    text: str
    start_offset_ms: int
    created_at: datetime


class TranscriptSegmentIn(BaseModel):
    """One transcript chunk posted by the provider's browser as Daily
    fires `transcription-message` events. We accept multiple per
    request to keep the network chatty under control."""

    speaker_role: SpeakerRoleLiteral = "unknown"
    daily_participant_id: str | None = None
    text: str = Field(min_length=1, max_length=8000)
    start_offset_ms: int = Field(ge=0)


class TranscriptBatchIn(BaseModel):
    segments: list[TranscriptSegmentIn] = Field(min_length=1, max_length=50)


class TelehealthSessionOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    appointment_id: UUID
    daily_room_url: str
    daily_room_name: str
    status: SessionStatusLiteral
    patient_consented_at: datetime | None = None
    provider_started_at: datetime | None = None
    ended_at: datetime | None = None
    created_at: datetime


class TelehealthSessionWithTokenOut(TelehealthSessionOut):
    """Returned to the provider on session create. The meeting token
    is short-lived (~2h) so we mint a fresh one per session.

    Not returned anywhere else — tokens never leave the create
    response. The patient gets their own token via the consent
    endpoint."""

    meeting_token: str


class PatientConsentOut(BaseModel):
    """Returned to the patient after they accept the consent prompt.
    The token + url let them join the call."""

    session_id: UUID
    daily_room_url: str
    meeting_token: str


class SoapDraftOut(BaseModel):
    """LLM-generated SOAP draft. The provider edits + signs in the
    existing SoapNoteDrawer UI; nothing is persisted to soap_notes
    until they save."""

    subjective: str = ""
    objective: str = ""
    assessment: str = ""
    plan: str = ""
    # The transcript word count we sent to the LLM — useful for
    # debugging short visits with sparse drafts.
    source_word_count: int = 0
    model: str
